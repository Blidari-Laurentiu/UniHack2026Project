// Person A: every word the lease pages show, in English and Romanian.
// A value is a string, or a function when it needs numbers or names. Marks <b>, <code> and
// <mark> are turned into elements by rich() in i18n.jsx. SQL, JSON, neighbourhood names and
// quotes from the lease are not translated; neither is a saved report (it keeps the language
// it was written in).
import { createT, enCount, roCount } from '../../i18n.jsx';

const en0 = new Intl.NumberFormat('en-IE');
const ro0 = new Intl.NumberFormat('ro-RO');

const en = {
  // Shared pieces
  rooms: (n) => enCount(n, 'room', 'rooms'),
  listings: (n) => enCount(n, 'listing', 'listings'),
  perMonth: 'a month',
  wholeCity: 'Whole city',
  wholeCityInline: 'whole city',
  flatSize: 'Flat size',
  neighbourhood: 'Neighbourhood',
  sampleData: 'Based on sample listing data.',
  retry: 'Retry',
  noReport: 'No report',

  'verdict.below_market': 'Below market',
  'verdict.fair': 'Fair price',
  'verdict.above_market': 'Above market',
  'verdict.suspiciously_low': 'Possibly a scam',
  'risk.low': 'Low risk',
  'risk.medium': 'Medium risk',
  'risk.high': 'High risk',
  'severity.low': 'Severity: Low',
  'severity.medium': 'Severity: Medium',
  'severity.high': 'Severity: High',
  'category.deposit': 'Deposit',
  'category.rent_increase': 'Rent increase',
  'category.termination': 'Termination',
  'category.repairs': 'Repairs',
  'category.utilities': 'Utilities',
  'category.owner_access': 'Owner access',
  'category.handover': 'Handover',
  'category.registration': 'Registration',
  'category.payment': 'Payment',
  'category.penalties': 'Penalties',
  'category.other': 'Other',

  // Lease page
  'page.title': 'Lease check',
  'page.lead':
    'Paste your rental contract or upload it as a PDF. We flag risky clauses, list what is missing and compare the rent with similar flats in the neighbourhood.',
  'page.yourLease': 'Your lease',
  'page.loginPrompt': 'Log in to check a lease and keep your past checks.',
  'page.loading': 'Reading your lease… this can take up to 30 seconds.',
  'page.sessionExpired': 'Your session has expired.',
  'page.result': 'Result',
  'page.trend': 'Price trend',
  'page.byHood': 'Rent by neighbourhood',
  'page.pastChecks': 'Your past checks',
  'page.seeAll': 'See all checks →',

  // Form
  'form.upload': 'Upload a PDF',
  'form.uploading': 'Reading the PDF…',
  'form.uploadHint': 'or paste the text below. The PDF must have selectable text (not a scan), up to 5 MB.',
  'form.uploadNote': (name, pages, chars) =>
    `Text taken from ${name}: ${enCount(pages, 'page', 'pages')}, ${enCount(chars, 'character', 'characters')}. Read it through and fix anything that looks wrong.`,
  'form.pdfTooBig': 'The PDF is too big: at most 5 MB. Paste the lease text instead.',
  'form.pdfSession': 'Your session has expired. Log in again, then choose the PDF again.',
  'form.text': 'Lease text (Romanian or English)',
  'form.textPlaceholder': 'CONTRACT DE ÎNCHIRIERE…  Paste the whole lease here.',
  'form.counter': (len, max) => `${en0.format(len)} / ${en0.format(max)} characters`,
  'form.counterMin': (min) => ` (at least ${min})`,
  'form.hoodLoading': 'Loading…',
  'form.choose': 'Choose…',
  'form.rooms': 'Rooms (camere), living room included',
  'form.studio': '1 (studio)',
  'form.rent': 'Monthly rent (EUR)',
  'form.rentPlaceholder': 'e.g. 450',
  'form.reportLanguage': 'Report language',
  'form.submit': 'Check my lease',
  'form.submitting': 'Checking…',
  'error.textShort': (min) => `Paste the lease: at least ${min} characters.`,
  'error.textLong': (max) => `The lease is too long: at most ${en0.format(max)} characters.`,
  'error.hood': 'Choose a neighbourhood.',
  'error.hoodUnknown': 'Choose a neighbourhood from the list.',
  'error.rooms': (min, max) => `Rooms must be ${min} to ${max}.`,
  'error.rent': 'Enter the monthly rent in EUR (more than 0).',
  'error.rentMax': (max) => `Rent must be at most ${en0.format(max)} EUR.`,
  'error.language': 'Choose English or Romanian.',

  // Result
  'result.checked': (date) => `checked ${date}`,
  'result.noReportTitle': 'The clause check did not run this time.',
  'result.noReportFallback': 'The AI report is unavailable.',
  'result.noReportHint': 'The price check still works. Try the clause check again in a minute.',
  'result.disclaimerTitle': 'Not legal advice.',
  'result.disclaimer':
    'This is an automatic first check to help you ask the right questions. For a binding opinion, ask a lawyer or a notary before you sign.',

  // Price badge
  'price.title': 'Price check',
  'price.line': (rent, pct, median, rooms, hood) =>
    `${rent} is <b>${pct}</b> vs the median of <b>${median}</b> for ${rooms} ${hood ? `in ${hood}` : 'across Timișoara'}.`,
  'price.scam':
    "Far below the market. Never pay a deposit before you have seen the flat and the owner's ID and property papers.",
  'price.cityWide': 'City-wide comparison (few listings here)',

  // Report
  'report.aria': 'Lease report',
  'report.title': 'Clause check',
  'report.overall': (risk) => `Overall: ${risk}`,
  'report.risky': (n) => `Risky clauses (${n})`,
  'report.riskyNone': 'No risky clauses found.',
  'report.why': 'Why it matters: ',
  'report.ask': 'What to ask for: ',
  'report.missing': (n) => `Missing clauses (${n})`,
  'report.missingNone': 'Nothing important seems to be missing.',

  // History (card on the lease page, list page, detail page)
  'history.loading': 'Loading your checks…',
  'history.emptyShort': 'No checks yet. Your past lease checks will show up here.',
  'history.opening': 'Opening…',
  'history.back': '← Lease check',
  'history.title': 'Your lease checks',
  'history.lead': 'Every lease you have checked, newest first. Open one to see the full report.',
  'history.all': 'All checks',
  'history.empty': 'No checks yet.',
  'history.emptyHint': 'When you check a lease, it is saved here so you can come back to it.',
  'history.checkOne': 'Check a lease',
  'history.filters': 'Filter checks',
  'history.allHoods': 'All neighbourhoods',
  'history.verdict': 'Price verdict',
  'history.allVerdicts': 'All verdicts',
  'history.count': (shown, total) => `${shown} of ${enCount(total, 'check', 'checks')}`,
  'history.reset': 'Reset filters',
  'history.noMatch': 'No checks match these filters.',
  'detail.back': '← Back to all checks',
  'detail.loading': 'Loading this check…',
  'detail.notFound': 'Check not found',
  'detail.notFoundHint':
    'This lease check does not exist, or it belongs to another account. Check the link, or pick one from your list.',
  'detail.seeAll': 'See all checks',
  'detail.title': (hood) => `Lease check: ${hood}`,

  // Rent by neighbourhood chart
  'median.loading': 'Loading neighbourhood prices…',
  'median.empty': 'No listing data yet, so there is nothing to compare.',
  'median.sub': (rooms) => `Median monthly rent for ${rooms}, highest first.`,
  'median.none': (rooms) => `No neighbourhood has ${rooms} listings yet.`,
  'median.rowTitle': (name, median, listings) => `${name}: ${median} median, ${listings}`,
  'median.yourArea': 'your area',
  'median.yourRent': (rent) => `your rent: ${rent}`,
  'median.offScale': ' (off the scale →)',
  'median.caption': (rooms) => `Median monthly rent for ${rooms} by neighbourhood, highest first`,
  'median.colRent': 'Median rent',
  'median.colListings': 'Listings',
  'median.skipped': (rooms, names) => `Not shown (no ${rooms} listings): ${names}.`,
  'median.note': 'Listing counts cover all flat sizes in the neighbourhood.',

  // Price trend chart
  'trend.loading': 'Loading the price trend…',
  'trend.notEnough': (months, n, hood) =>
    `Not enough data: fewer than ${months} months have ${n}-room listings ${hood ? `in ${hood} or the city` : 'in the city'}, so there is no trend to show.`,
  'trend.summary': (rooms, where) => `Median monthly rent for ${rooms}, ${where}`,
  'trend.summaryChange': (first, firstMonth, last, lastMonth, pct) =>
    `: ${first} in ${firstMonth}, ${last} in ${lastMonth} (${pct}).`,
  'trend.fellBack': (have, n, hood) =>
    `Only ${have} of the last 12 months have ${n}-room listings in ${hood}, so this shows the whole city instead.`,
  'trend.headline': (last, lastMonth, pct, firstMonth) => `<b>${last}</b> in ${lastMonth}, ${pct} since ${firstMonth}`,
  'trend.soFar': ' (so far)',
  'trend.caption': ' Month by month, oldest first; listing counts in brackets.',
  'trend.month': 'Month',
  'trend.noListings': 'no listings',
  'trend.area': 'Area',
  'trend.note':
    'Based on sample listing data: median asking rent per calendar month, last 12 months. Hollow dots and a dashed last step mark the current month, which is still filling up. Hover or tap a month for listing counts.',

  // How this was checked
  'how.title': 'How this was checked',
  'how.hint': 'What Gemini saw, what it answered, and the SQL behind the price',
  'how.loading': 'Loading the details…',
  'how.tabSent': 'Sent to Gemini',
  'how.tabAnswer': "Gemini's raw answer",
  'how.tabSql': 'The SQL',
  'how.copyJson': 'Copy JSON',
  'how.copyQuery': 'Copy query',
  'how.copied': 'Copied',
  'how.copyFailed': 'Could not copy. Select the text instead.',
  'how.sentIntro':
    'Gemini received only this text, with our checklist prompt and the <code>LeaseReport</code> JSON schema.',
  'how.sentRedacted': (n) =>
    `Our server replaced <b>${n}</b> personal ${n === 1 ? 'ID' : 'IDs'} (CNP, IBAN, ID card or passport numbers) with <mark>[REDACTED]</mark> before the request.`,
  'how.sentNone': 'No CNP, IBAN, ID card or passport number was found in this lease.',
  'how.sentSaved': 'Only this redacted copy is saved.',
  'how.sentAria': 'Lease text sent to Gemini',
  'how.sentNoText': 'No lease text was saved with this check.',
  'how.answerMissing': 'Gemini did not return a report for this check.',
  'how.answerMissingFallback': 'No report was saved.',
  'how.answerMissingHint':
    'The price verdict did not need it: it comes straight from the database (see “The SQL”).',
  'how.answerIntro':
    'Gemini answered in JSON (<code>response_mime_type: application/json</code> with the <code>LeaseReport</code> schema). We validate it with Pydantic, retry once if it is invalid, and render the report above from exactly this.',
  'how.answerAria': "Gemini's JSON answer",
  'how.sqlVerdictTitle': '1. Price verdict: one query on the listings hypertable',
  'how.sqlVerdict': (months, minSample) =>
    `The neighbourhood and the city-wide median for the same room count, over the last ${months} months, in one round trip. Fair is within ±10% of the median; more than 30% below is flagged as a possible scam. Under ${minSample} listings in the neighbourhood, the city-wide median is used.`,
  'how.parameters': 'Parameters: ',
  'how.medianAria': 'Median query',
  'how.comparedWith': 'Compared with',
  'how.comparedValue': (listings, rooms, hood) =>
    `${listings} with ${rooms}${hood ? ` in ${hood}` : ' across Timișoara (too few in the neighbourhood)'}`,
  'how.median': 'Median',
  'how.yourRent': 'Your rent',
  'how.verdict': 'Verdict',
  'how.sqlTrendTitle': '2. Price trend: a TimescaleDB continuous aggregate',
  'how.sqlTrend':
    'The trend chart reads monthly medians from <code>listings_monthly</code>, which TimescaleDB keeps up to date: a policy re-materializes it every hour, and the current month is computed live from new listings (real-time aggregation).',
  'how.trendAria': 'Trend query',
  'how.aggregateSummary': 'How listings_monthly is defined',
  'how.aggregateAria': 'Continuous aggregate definition',
};

const ro = {
  // Shared pieces
  rooms: (n) => roCount(n, 'cameră', 'camere'),
  listings: (n) => roCount(n, 'anunț', 'anunțuri'),
  perMonth: 'pe lună',
  wholeCity: 'Tot orașul',
  wholeCityInline: 'tot orașul',
  flatSize: 'Mărimea apartamentului',
  neighbourhood: 'Cartier',
  sampleData: 'Calculat pe un set demonstrativ de anunțuri.',
  retry: 'Reîncearcă',
  noReport: 'Fără raport',

  'verdict.below_market': 'Sub prețul pieței',
  'verdict.fair': 'Preț corect',
  'verdict.above_market': 'Peste prețul pieței',
  'verdict.suspiciously_low': 'Posibilă înșelătorie',
  'risk.low': 'Risc scăzut',
  'risk.medium': 'Risc mediu',
  'risk.high': 'Risc ridicat',
  'severity.low': 'Gravitate: scăzută',
  'severity.medium': 'Gravitate: medie',
  'severity.high': 'Gravitate: ridicată',
  'category.deposit': 'Garanție',
  'category.rent_increase': 'Majorarea chiriei',
  'category.termination': 'Reziliere',
  'category.repairs': 'Reparații',
  'category.utilities': 'Utilități',
  'category.owner_access': 'Accesul proprietarului',
  'category.handover': 'Predare-primire',
  'category.registration': 'Înregistrare',
  'category.payment': 'Plată',
  'category.penalties': 'Penalități',
  'category.other': 'Altele',

  // Lease page
  'page.title': 'Verificare contract de închiriere',
  'page.lead':
    'Lipește contractul de închiriere sau încarcă-l ca PDF. Îți arătăm clauzele riscante, ce lipsește și cum este chiria față de apartamente similare din cartier.',
  'page.yourLease': 'Contractul tău',
  'page.loginPrompt': 'Autentifică-te ca să verifici un contract și să păstrezi verificările anterioare.',
  'page.loading': 'Citim contractul… poate dura până la 30 de secunde.',
  'page.sessionExpired': 'Sesiunea a expirat.',
  'page.result': 'Rezultat',
  'page.trend': 'Evoluția prețurilor',
  'page.byHood': 'Chirii pe cartiere',
  'page.pastChecks': 'Verificările tale anterioare',
  'page.seeAll': 'Vezi toate verificările →',

  // Form
  'form.upload': 'Încarcă un PDF',
  'form.uploading': 'Citim PDF-ul…',
  'form.uploadHint': 'sau lipește textul mai jos. PDF-ul trebuie să aibă text selectabil (nu scanat), cel mult 5 MB.',
  'form.uploadNote': (name, pages, chars) =>
    `Text preluat din ${name}: ${roCount(pages, 'pagină', 'pagini')}, ${roCount(chars, 'caracter', 'caractere')}. Citește-l și corectează ce pare greșit.`,
  'form.pdfTooBig': 'PDF-ul este prea mare: cel mult 5 MB. Lipește textul contractului.',
  'form.pdfSession': 'Sesiunea a expirat. Autentifică-te din nou, apoi alege iar PDF-ul.',
  'form.text': 'Textul contractului (în română sau engleză)',
  'form.textPlaceholder': 'CONTRACT DE ÎNCHIRIERE…  Lipește aici tot contractul.',
  'form.counter': (len, max) => `${ro0.format(len)} / ${roCount(max, 'caracter', 'caractere')}`,
  'form.counterMin': (min) => ` (cel puțin ${min})`,
  'form.hoodLoading': 'Se încarcă…',
  'form.choose': 'Alege…',
  'form.rooms': 'Camere (inclusiv sufrageria)',
  'form.studio': '1 (garsonieră)',
  'form.rent': 'Chirie lunară (EUR)',
  'form.rentPlaceholder': 'ex. 450',
  'form.reportLanguage': 'Limba raportului',
  'form.submit': 'Verifică contractul',
  'form.submitting': 'Verificăm…',
  'error.textShort': (min) => `Lipește contractul: cel puțin ${roCount(min, 'caracter', 'caractere')}.`,
  'error.textLong': (max) => `Contractul este prea lung: cel mult ${roCount(max, 'caracter', 'caractere')}.`,
  'error.hood': 'Alege un cartier.',
  'error.hoodUnknown': 'Alege un cartier din listă.',
  'error.rooms': (min, max) => `Numărul de camere trebuie să fie între ${min} și ${max}.`,
  'error.rent': 'Introdu chiria lunară în EUR (mai mare decât 0).',
  'error.rentMax': (max) => `Chiria poate fi cel mult ${ro0.format(max)} EUR.`,
  'error.language': 'Alege engleză sau română.',

  // Messages for errors that come from the server in English, chosen by HTTP status
  // (0 = the server could not be reached). English shows the server's own text.
  'status.0': 'Nu putem contacta serverul. Verifică internetul și încearcă din nou; serverul poate avea nevoie de un minut ca să pornească.',
  'status.401': 'Trebuie să fii autentificat. Autentifică-te și încearcă din nou.',
  'status.422': 'Datele trimise nu sunt valide. Verifică formularul și încearcă din nou.',
  'status.429':
    'Ai atins limita de verificări pentru 24 de ore. Studenții verificați au o limită mai mare. Încearcă din nou mai târziu.',
  'status.503': 'Serviciul nu este disponibil momentan. Încearcă din nou peste puțin timp.',
  // PDF upload errors, by status; the 422 cases are told apart by a word in the server's text.
  'pdf.413': 'PDF-ul este prea mare: cel mult 5 MB. Lipește textul contractului.',
  'pdf.415': 'Fișierul nu este un PDF. Alege un PDF sau lipește textul contractului.',
  'pdf.422': 'Nu am putut prelua textul din acest PDF. Lipește textul contractului.',
  'pdf.noText': 'Nu am găsit text în acest PDF. Probabil este scanat (o fotografie a paginilor). Lipește textul contractului.',
  'pdf.password': 'PDF-ul este protejat cu parolă. Lipește textul contractului.',
  'pdf.pages': 'PDF-ul are prea multe pagini: cel mult 40. Lipește textul contractului.',
  'pdf.tooLong': 'Textul din PDF este prea lung: cel mult 50.000 de caractere. Lipește doar partea cu clauzele.',

  // Result
  'result.checked': (date) => `verificat pe ${date}`,
  'result.noReportTitle': 'Verificarea clauzelor nu a rulat de data aceasta.',
  'result.noReportFallback': 'Raportul AI nu este disponibil.',
  'result.noReportHint':
    'Verificarea prețului funcționează în continuare. Încearcă din nou verificarea clauzelor peste un minut.',
  'result.disclaimerTitle': 'Nu este consultanță juridică.',
  'result.disclaimer':
    'Este o primă verificare automată, care te ajută să pui întrebările potrivite. Pentru o opinie avizată, întreabă un avocat sau un notar înainte să semnezi.',

  // Price badge
  'price.title': 'Verificarea prețului',
  'price.line': (rent, pct, median, rooms, hood) =>
    `${rent} înseamnă <b>${pct}</b> față de mediana de <b>${median}</b> pentru ${rooms} ${hood ? `în ${hood}` : 'în toată Timișoara'}.`,
  'price.scam':
    'Mult sub prețul pieței. Nu plăti niciodată garanția înainte să vezi apartamentul, actul de identitate al proprietarului și actele de proprietate.',
  'price.cityWide': 'Comparație pe tot orașul (puține anunțuri aici)',

  // Report
  'report.aria': 'Raportul contractului',
  'report.title': 'Verificarea clauzelor',
  'report.overall': (risk) => `General: ${risk}`,
  'report.risky': (n) => `Clauze riscante (${n})`,
  'report.riskyNone': 'Nu am găsit clauze riscante.',
  'report.why': 'De ce contează: ',
  'report.ask': 'Ce să ceri: ',
  'report.missing': (n) => `Clauze lipsă (${n})`,
  'report.missingNone': 'Nu pare să lipsească nimic important.',

  // History
  'history.loading': 'Se încarcă verificările…',
  'history.emptyShort': 'Nicio verificare încă. Verificările tale vor apărea aici.',
  'history.opening': 'Se deschide…',
  'history.back': '← Verificare contract',
  'history.title': 'Verificările tale',
  'history.lead': 'Toate contractele verificate, de la cel mai recent. Deschide unul ca să vezi raportul complet.',
  'history.all': 'Toate verificările',
  'history.empty': 'Nicio verificare încă.',
  'history.emptyHint': 'Când verifici un contract, îl salvăm aici ca să poți reveni la el.',
  'history.checkOne': 'Verifică un contract',
  'history.filters': 'Filtrează verificările',
  'history.allHoods': 'Toate cartierele',
  'history.verdict': 'Verdict de preț',
  'history.allVerdicts': 'Toate verdictele',
  'history.count': (shown, total) => `${shown} din ${roCount(total, 'verificare', 'verificări')}`,
  'history.reset': 'Resetează filtrele',
  'history.noMatch': 'Nicio verificare nu corespunde filtrelor.',
  'detail.back': '← Înapoi la toate verificările',
  'detail.loading': 'Se încarcă verificarea…',
  'detail.notFound': 'Verificarea nu a fost găsită',
  'detail.notFoundHint':
    'Această verificare nu există sau aparține altui cont. Verifică linkul sau alege una din lista ta.',
  'detail.seeAll': 'Vezi toate verificările',
  'detail.title': (hood) => `Verificare contract: ${hood}`,

  // Rent by neighbourhood chart
  'median.loading': 'Se încarcă prețurile pe cartiere…',
  'median.empty': 'Nu avem încă anunțuri, deci nu avem cu ce compara.',
  'median.sub': (rooms) => `Chiria lunară mediană pentru ${rooms}, de la cea mai mare.`,
  'median.none': (rooms) => `Niciun cartier nu are încă anunțuri cu ${rooms}.`,
  'median.rowTitle': (name, median, listings) => `${name}: mediană ${median}, ${listings}`,
  'median.yourArea': 'zona ta',
  'median.yourRent': (rent) => `chiria ta: ${rent}`,
  'median.offScale': ' (în afara scalei →)',
  'median.caption': (rooms) => `Chiria lunară mediană pentru ${rooms}, pe cartiere, de la cea mai mare`,
  'median.colRent': 'Chirie mediană',
  'median.colListings': 'Anunțuri',
  'median.skipped': (rooms, names) => `Nu apar (fără anunțuri cu ${rooms}): ${names}.`,
  'median.note': 'Numărul de anunțuri include toate mărimile de apartament din cartier.',

  // Price trend chart
  'trend.loading': 'Se încarcă evoluția prețurilor…',
  'trend.notEnough': (months, n, hood) =>
    `Date insuficiente: mai puțin de ${months} luni au anunțuri cu ${roCount(n, 'cameră', 'camere')} ${hood ? `în ${hood} sau în oraș` : 'în oraș'}, deci nu avem o evoluție de arătat.`,
  'trend.summary': (rooms, where) => `Chiria lunară mediană pentru ${rooms}, ${where}`,
  'trend.summaryChange': (first, firstMonth, last, lastMonth, pct) =>
    `: ${first} în ${firstMonth}, ${last} în ${lastMonth} (${pct}).`,
  'trend.fellBack': (have, n, hood) =>
    `Doar ${have} din ultimele 12 luni au anunțuri cu ${roCount(n, 'cameră', 'camere')} în ${hood}, așa că arătăm tot orașul.`,
  'trend.headline': (last, lastMonth, pct, firstMonth) => `<b>${last}</b> în ${lastMonth}, ${pct} față de ${firstMonth}`,
  'trend.soFar': ' (până acum)',
  'trend.caption': ' Lună de lună, de la cea mai veche; numărul de anunțuri este în paranteze.',
  'trend.month': 'Luna',
  'trend.noListings': 'fără anunțuri',
  'trend.area': 'Zonă',
  'trend.note':
    'Calculat pe un set demonstrativ de anunțuri: chiria mediană cerută, pe luni calendaristice, în ultimele 12 luni. Punctele goale și ultimul segment punctat marchează luna curentă, care încă se completează. Treci cu mouse-ul peste o lună sau atinge-o ca să vezi numărul de anunțuri.',

  // How this was checked
  'how.title': 'Cum a fost verificat',
  'how.hint': 'Ce a văzut Gemini, ce a răspuns și interogările SQL din spatele prețului',
  'how.loading': 'Se încarcă detaliile…',
  'how.tabSent': 'Trimis către Gemini',
  'how.tabAnswer': 'Răspunsul brut al lui Gemini',
  'how.tabSql': 'Interogările SQL',
  'how.copyJson': 'Copiază JSON',
  'how.copyQuery': 'Copiază interogarea',
  'how.copied': 'Copiat',
  'how.copyFailed': 'Nu s-a putut copia. Selectează textul.',
  'how.sentIntro':
    'Gemini a primit doar acest text, împreună cu promptul nostru cu lista de verificare și schema JSON <code>LeaseReport</code>.',
  'how.sentRedacted': (n) =>
    n === 1
      ? 'Serverul nostru a înlocuit <b>1</b> dată de identificare (CNP, IBAN, serie de buletin sau număr de pașaport) cu <mark>[REDACTED]</mark> înainte de cerere.'
      : `Serverul nostru a înlocuit <b>${n}</b> date de identificare (CNP, IBAN, serie de buletin sau număr de pașaport) cu <mark>[REDACTED]</mark> înainte de cerere.`,
  'how.sentNone': 'În acest contract nu am găsit CNP, IBAN, serie de buletin sau număr de pașaport.',
  'how.sentSaved': 'Salvăm doar această copie anonimizată.',
  'how.sentAria': 'Textul contractului trimis către Gemini',
  'how.sentNoText': 'Pentru această verificare nu a fost salvat textul contractului.',
  'how.answerMissing': 'Gemini nu a returnat un raport pentru această verificare.',
  'how.answerMissingFallback': 'Nu a fost salvat niciun raport.',
  'how.answerMissingHint':
    'Verdictul de preț nu a avut nevoie de el: vine direct din baza de date (vezi „Interogările SQL”).',
  'how.answerIntro':
    'Gemini a răspuns în JSON (<code>response_mime_type: application/json</code>, cu schema <code>LeaseReport</code>). Îl validăm cu Pydantic, mai încercăm o dată dacă nu este valid și afișăm raportul de mai sus exact din acest răspuns.',
  'how.answerAria': 'Răspunsul JSON al lui Gemini',
  'how.sqlVerdictTitle': '1. Verdictul de preț: o singură interogare pe hypertable-ul listings',
  'how.sqlVerdict': (months, minSample) =>
    `Mediana din cartier și mediana pe tot orașul, pentru același număr de camere, din ultimele ${months} luni, într-o singură interogare. „Preț corect” înseamnă cel mult ±10% față de mediană; o chirie cu peste 30% sub mediană este marcată ca posibilă înșelătorie. Sub ${roCount(minSample, 'anunț', 'anunțuri')} în cartier, folosim mediana pe tot orașul.`,
  'how.parameters': 'Parametri: ',
  'how.medianAria': 'Interogarea pentru mediană',
  'how.comparedWith': 'Comparat cu',
  'how.comparedValue': (listings, rooms, hood) =>
    `${listings} cu ${rooms}${hood ? ` în ${hood}` : ' în toată Timișoara (prea puține în cartier)'}`,
  'how.median': 'Mediană',
  'how.yourRent': 'Chiria ta',
  'how.verdict': 'Verdict',
  'how.sqlTrendTitle': '2. Evoluția prețurilor: un agregat continuu TimescaleDB',
  'how.sqlTrend':
    'Graficul de evoluție citește medianele lunare din <code>listings_monthly</code>, pe care TimescaleDB îl ține la zi: o politică îl rematerializează în fiecare oră, iar luna curentă se calculează în timp real din anunțurile noi (real-time aggregation).',
  'how.trendAria': 'Interogarea pentru evoluție',
  'how.aggregateSummary': 'Cum este definit listings_monthly',
  'how.aggregateAria': 'Definiția agregatului continuu',
};

export const STRINGS = { en, ro };
export const useT = createT(STRINGS);

const PDF_422 = [
  [/no text/i, 'pdf.noText'],
  [/password/i, 'pdf.password'],
  [/pages/i, 'pdf.pages'],
  [/too long/i, 'pdf.tooLong'],
];

/**
 * The message to show for an error from api.js. The server answers in English, so Romanian
 * picks a translated message by HTTP status and falls back to the server's text.
 * kind 'pdf' is for POST /lease/extract-text, whose statuses mean something more specific.
 */
export function errorMessage(error, t, kind) {
  const fallback = error?.message || String(error);
  const status = error?.status;
  if (kind === 'pdf') {
    if (status === 401) return t('form.pdfSession');
    const byText = status === 422 ? PDF_422.find(([pattern]) => pattern.test(fallback))?.[1] : null;
    const specific = t.opt(byText || `pdf.${status}`);
    if (specific) return specific;
  }
  return t.opt(`status.${status}`) ?? fallback;
}
