"""POST /lease/extract-text (Feature A): the text layer of an uploaded lease PDF.

No database and no Gemini are involved, so these tests run anywhere. The PDFs are built here:
make_pdf() writes a small valid file by hand, with a ToUnicode map so Romanian diacritics can be
checked; pypdf's writer makes the blank, encrypted and many-page variants.
"""

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pypdf import PdfReader, PdfWriter  # noqa: E402

from auth import authenticate  # noqa: E402
from main import app  # noqa: E402
from schemas.lease import LEASE_TEXT_MAX  # noqa: E402
from services import pdf_text  # noqa: E402
from services.gemini import REDACTED, redact  # noqa: E402

URL = "/lease/extract-text"
FAKE_IDENTITY = {"auth0_sub": "dev|mei", "email": None, "is_student": True, "display_name": "Mei"}

CNP = "1960523350011"
IBAN = "RO49 AAAA 1B31 0075 9384 0000"
PAGE_1 = (
    "CONTRACT DE ÎNCHIRIERE\n"
    f"Proprietar: Ion Popescu, CNP {CNP}, act de identitate seria TM nr. 123456.\n"
    f"Chiria se plătește în contul {IBAN}, până în data de 5 a fiecărei luni."
)
PAGE_2 = (
    "Garanția nu se restituie în cazul oricărei uzuri a apartamentului.\n"
    "Chiriașul și proprietarul semnează în două exemplare, la Timișoara."
)


def make_pdf(pages: list[str]) -> bytes:
    """A valid PDF with one text line per line of each page, in any characters (up to 255)."""
    chars = sorted({c for page in pages for c in page if c != "\n"})
    assert len(chars) <= 255
    code = {c: i + 1 for i, c in enumerate(chars)}

    def hex_string(line: str) -> str:
        return "<" + "".join(f"{code[c]:02X}" for c in line) + ">"

    def stream(body: bytes) -> bytes:
        return b"<< /Length %d >>\nstream\n" % len(body) + body + b"\nendstream"

    maps = [f"<{n:02X}> <{c.encode('utf-16-be').hex().upper()}>" for c, n in code.items()]
    cmap = (
        "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n"
        "/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n"
        "1 begincodespacerange\n<00> <FF>\nendcodespacerange\n"
        + "".join(
            f"{len(chunk)} beginbfchar\n" + "\n".join(chunk) + "\nendbfchar\n"
            for chunk in (maps[i : i + 100] for i in range(0, len(maps), 100))
        )
        + "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend"
    )

    first_page = 5  # objects 1 to 4 are the catalog, the page tree, the font and its map
    kids = " ".join(f"{first_page + 2 * i} 0 R" for i in range(len(pages)))
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode(),
        (
            f"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 1 /LastChar {len(chars)}"
            f" /Widths [{' '.join(['600'] * len(chars))}] /ToUnicode 4 0 R >>"
        ).encode(),
        stream(cmap.encode()),
    ]
    for i, page in enumerate(pages):
        lines = " T* ".join(f"{hex_string(line)} Tj" for line in page.split("\n"))
        objects.append(
            (
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]"
                f" /Resources << /Font << /F1 3 0 R >> >> /Contents {first_page + 2 * i + 1} 0 R >>"
            ).encode()
        )
        objects.append(stream(f"BT /F1 10 Tf 40 790 Td 14 TL {lines} ET".encode()))

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for n, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % n + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % off for off in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def rewritten(pdf: bytes, password: str | None = None) -> bytes:
    writer = PdfWriter()
    writer.append(PdfReader(io.BytesIO(pdf)))
    if password is not None:
        writer.encrypt(user_password=password, owner_password="owner-secret")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def blank_pdf(pages: int) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


@pytest.fixture
def client():
    app.dependency_overrides[authenticate] = lambda: FAKE_IDENTITY
    # No `with`: skips the lifespan, so the DB pool is never opened.
    yield TestClient(app)
    app.dependency_overrides.clear()


def upload(client, data: bytes, name="lease.pdf", content_type="application/pdf"):
    return client.post(URL, files={"file": (name, data, content_type)})


def test_pdf_text_is_returned_with_diacritics(client):
    r = upload(client, make_pdf([PAGE_1, PAGE_2]))
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"text", "pages", "characters"}
    assert body["pages"] == 2
    assert body["characters"] == len(body["text"])
    for line in (PAGE_1 + "\n" + PAGE_2).split("\n"):
        assert line in body["text"]  # ă, â, î, ș and ț all survive


def test_extracted_text_is_still_redacted_by_analyze(client):
    # The endpoint returns the user's own text unredacted; redaction runs in /lease/analyze.
    text = upload(client, make_pdf([PAGE_1, PAGE_2])).json()["text"]
    redacted = redact(text)
    assert redacted.count(REDACTED) == 3
    for secret in (CNP, IBAN, "123456"):
        assert secret not in redacted


def test_demo_pdf_matches_the_demo_lease(client):
    """data/sample_leases/demo_ro.pdf is demo_ro.txt printed to PDF. Its text must redact the
    same way and differ only in whitespace, which is what the DEMO_CACHE lookup compares."""
    from services import gemini

    r = upload(client, (gemini.SAMPLE_DIR / "demo_ro.pdf").read_bytes())
    assert r.status_code == 200, r.text
    from_pdf = redact(r.json()["text"])
    from_txt = redact(gemini.DEMO_LEASE.read_text(encoding="utf-8"))
    assert from_pdf.count(REDACTED) == from_txt.count(REDACTED) == 4
    assert gemini._normalise(from_pdf) == gemini._normalise(from_txt)


def test_not_a_pdf_415(client):
    r = upload(client, b"CONTRACT DE INCHIRIERE, as plain text " * 5, name="lease.txt", content_type="text/plain")
    assert r.status_code == 415
    assert r.json() == {"detail": pdf_text.NOT_PDF}


def test_wrong_content_in_a_pdf_named_file_415(client):
    r = upload(client, b"PK\x03\x04 this is really a .docx", name="lease.pdf")
    assert r.status_code == 415


def test_pdf_without_text_422(client):
    # A scan: pages but no text layer.
    r = upload(client, blank_pdf(2))
    assert r.status_code == 422
    assert r.json() == {"detail": pdf_text.NO_TEXT}


def test_too_big_413(client):
    r = upload(client, b"%PDF-1.4\n" + b"0" * pdf_text.MAX_BYTES)
    assert r.status_code == 413
    assert r.json() == {"detail": pdf_text.TOO_BIG}


def test_no_token_401():
    r = upload(TestClient(app), make_pdf([PAGE_1]))
    assert r.status_code == 401
    assert "detail" in r.json()


def test_password_protected_422(client):
    r = upload(client, rewritten(make_pdf([PAGE_1]), password="secret"))
    assert r.status_code == 422
    assert r.json() == {"detail": pdf_text.ENCRYPTED}


def test_owner_password_only_still_opens(client):
    # Print or copy restrictions with an empty user password: every PDF viewer opens these.
    r = upload(client, rewritten(make_pdf([PAGE_1]), password=""))
    assert r.status_code == 200, r.text
    assert "CONTRACT DE ÎNCHIRIERE" in r.json()["text"]


def test_too_many_pages_422(client):
    r = upload(client, blank_pdf(pdf_text.MAX_PAGES + 1))
    assert r.status_code == 422
    assert r.json() == {"detail": pdf_text.TOO_MANY_PAGES}


def test_text_over_the_lease_limit_422(client):
    line = "Chiriasul plateste chiria lunar. " * 3
    page = "\n".join([line] * (LEASE_TEXT_MAX // len(line) + 20))
    r = upload(client, make_pdf([page]))
    assert r.status_code == 422
    assert r.json() == {"detail": pdf_text.TOO_LONG}


def test_damaged_pdf_422(client):
    r = upload(client, b"%PDF-1.4\nthis is not a real pdf body\n%%EOF\n")
    assert r.status_code == 422
    assert r.json() == {"detail": pdf_text.UNREADABLE}


def test_missing_file_422(client):
    r = client.post(URL)
    assert r.status_code == 422
    assert "detail" in r.json()


def test_control_characters_are_removed():
    # Postgres text cannot store NUL, and the text is saved later by /lease/analyze.
    assert pdf_text._clean("a\x00b\r\nc \n\n\n\nd\x0c") == "ab\nc\n\nd"
