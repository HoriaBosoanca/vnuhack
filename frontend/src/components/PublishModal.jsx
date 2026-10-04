import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import { useStore, S, closeM, openM, openTerms, toast, goToFirstInvalid, publishListing } from '../lib/store'
import { TILES, geocode } from '../lib/geo'
import { COUNTIES, COUNTY_NAMES, HOURS, HOURS_END, RULE_PRESETS, TERMS_VERSION, fmtSize, locText, validPhone, shrinkImage } from '../lib/utils'
import { Field, Modal, CloseBtn, useErrs } from './ui'
import Calendar from './Calendar'

const MAX_PHOTOS = 10, MAX_MB = 10
const NOISE = ['Normal — până la 55 dB', 'Moderat — până la 65 dB', 'Ridicat — până la 80 dB', 'Fără limită specificată']
const GEO_HINT = 'Completează județul, localitatea și adresa. Pinul se pune singur; îl poți trage pe locul exact.'
const empty = () => ({
  title: '', type: 'storage', price: '', area: '', unit: 'lună', county: '', city: '', address: '', phone: '', noise: NOISE[0],
  access: 'custom', from: '08:00', to: '22:00', desc: '', isu: false, ext: false, evac: false, smoke: false, isuNo: '', declare: false,
})

/* ---- Avertisment înainte de publicare ---- */
function RiskModal({ onConfirm }) {
  const s = useStore()
  const [agree, setAgree] = useState(false), [err, setErr] = useState('')
  useEffect(() => { if (s.ui.open.risk) { setAgree(false); setErr('') } }, [s.ui.open.risk])
  const confirm = () => {
    if (!agree) { setErr('Bifează ca să confirmi că ești de acord.'); return goToFirstInvalid('riskModal') }
    closeM('risk'); onConfirm(new Date())
  }
  return (
    <Modal name="risk" id="riskModal" boxClass="modalbox risk" boxProps={{ role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'riskTitle', 'aria-describedby': 'riskText' }}>
      <div className="risk-head"><div className="risk-icon" aria-hidden="true">⚠️</div><h2 id="riskTitle">Atenție! Citește cu atenție înainte să publici</h2></div>
      <div className="risk-body" id="riskText">
        <p>Prin publicarea acestui anunț declari pe propria răspundere că:</p>
        <ul>
          <li>ai citit și accepți integral <a href="#" onClick={e => { e.preventDefault(); openTerms() }}>Termenii și condițiile</a> SPAȚIU;</li>
          <li><b>ai luat sau ai pus în siguranță toate obiectele de valoare</b> din spațiu (bani, bijuterii, documente, electronice și altele);</li>
          <li><b>îți asumi toate riscurile</b> legate de închirierea spațiului: pagube, furturi, accidente, incendii;</li>
          <li><b>îți asumi întreaga răspundere legală</b> pentru spațiu și pentru informațiile din anunț;</li>
          <li><b>compania SPAȚIU nu este responsabilă</b> pentru nicio pagubă, pierdere sau incident legat de spațiul tău sau de închirierea lui, în limita permisă de lege.</li>
        </ul>
        <Field err={err}><label className="check"><input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); if (e.target.checked) setErr('') }} /><span>Am citit, am înțeles și sunt de acord cu toate cele de mai sus.</span></label></Field>
      </div>
      <div className="form-actions"><button className="btn" onClick={() => closeM('risk')}>Înapoi la formular</button><button className="btn danger solid big" onClick={confirm}>Confirm și public anunțul</button></div>
    </Modal>
  )
}

export default function PublishModal() {
  const s = useStore(), open = s.ui.open.publish
  const [f, setF] = useState(empty), [photos, setPhotos] = useState([]), [days, setDays] = useState(() => new Set()), [calKey, setCalKey] = useState(0)
  const [rules, setRules] = useState([]), [ruleIn, setRuleIn] = useState(''), [contract, setContract] = useState(null)
  const [geoInfo, setGeoInfo] = useState(GEO_HINT), [busy, setBusy] = useState(false), [drag, setDrag] = useState(false)
  const { errs, check, clear, setErrs, reset } = useErrs()
  const titleRef = useRef(null), ruleRef = useRef(null), photoIn = useRef(null), contractIn = useRef(null)
  const mapEl = useRef(null), pubMap = useRef(null), pubPin = useRef(null), pubGeo = useRef(null), geoSeq = useRef(0), dirty = useRef(false)
  const fRef = useRef(f); fRef.current = f

  const set = (k, id) => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setF(o => ({ ...o, [k]: v })); if (v && id) clear(id) }

  /* La deschidere: precompletăm telefonul și pornim harta mică. */
  useEffect(() => {
    if (!open) return
    if (!fRef.current.phone && S.user?.phone) setF(o => ({ ...o, phone: S.user.phone }))
    ensurePubMap(); setTimeout(() => titleRef.current?.focus(), 50)
  }, [open])

  /* ---- Harta din formular ---- */
  function ensurePubMap() {
    if (!pubMap.current) { pubMap.current = L.map(mapEl.current, { scrollWheelZoom: false }).setView([45.9, 24.9], 6); L.tileLayer(TILES.url, TILES.opts).addTo(pubMap.current) }
    setTimeout(() => pubMap.current.invalidateSize(), 80)
  }
  function setPubPin(lat, lng, zoom) {
    if (!pubPin.current) {
      pubPin.current = L.marker([lat, lng], { draggable: true, icon: L.divIcon({ className: '', html: '<div class="geo-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 22] }) }).addTo(pubMap.current)
        .on('dragend', () => { const ll = pubPin.current.getLatLng(); pubGeo.current = { lat: ll.lat, lng: ll.lng, approx: false, manual: true }; setGeoInfo('✓ Ai poziționat pinul manual. Așa apare anunțul pe hărți.') })
    } else pubPin.current.setLatLng([lat, lng])
    pubMap.current.setView([lat, lng], zoom)
  }
  async function geocodeForm(manual) {
    const { county, city, address } = fRef.current
    if (!county || !city.trim()) { if (manual) setGeoInfo('Completează mai întâi județul și localitatea.'); return null }
    ensurePubMap(); const seq = ++geoSeq.current; setGeoInfo('Caut adresa pe hartă…')
    const r = await geocode({ address: address.trim(), city: city.trim(), county }); if (seq !== geoSeq.current) return pubGeo.current
    if (r) {
      pubGeo.current = { lat: r.lat, lng: r.lng, approx: r.approx }; setPubPin(r.lat, r.lng, r.approx ? 13 : 17)
      setGeoInfo(r.approx ? 'Am găsit localitatea, dar nu strada exactă. Trage pinul pe locul corect.' : '✓ Am găsit adresa. Dacă pinul nu e exact pe clădire, trage-l pe locul corect.')
    } else {
      const c = COUNTIES[county]; pubGeo.current = { lat: c[0], lng: c[1], approx: true }; setPubPin(c[0], c[1], 12)
      setGeoInfo('Nu am putut găsi adresa (verifică scrierea sau conexiunea). Trage pinul pe locul corect.')
    }
    return pubGeo.current
  }
  const placeChanged = () => { if (pubGeo.current && pubGeo.current.manual) return; pubGeo.current = null; setTimeout(() => geocodeForm(false), 0) }
  const onBlurPlace = () => { if (dirty.current) { dirty.current = false; placeChanged() } }

  /* ---- Poze ---- */
  async function addPhotos(files) {
    let skipped = 0, cur = photos.length
    for (const file of [...files]) {
      if (!file.type.startsWith('image/') || file.size > MAX_MB * 1024 * 1024 || cur >= MAX_PHOTOS) { skipped++; continue }
      cur++; const blob = await shrinkImage(file); setPhotos(p => [...p, { blob, url: URL.createObjectURL(blob) }]); clear('uploader')
    }
    if (skipped) toast(`${skipped} fișier(e) ignorat(e): doar imagini sub ${MAX_MB} MB, maximum ${MAX_PHOTOS} poze.`)
  }
  const makeCover = i => { if (!i) return; setPhotos(p => { const n = [...p]; n.unshift(n.splice(i, 1)[0]); return n }) }

  /* ---- Reguli ---- */
  const togglePreset = t => setRules(r => r.includes(t) ? r.filter(x => x !== t) : [...r, t])
  const addRule = () => {
    const t = ruleIn.trim(); if (!t) return ruleRef.current.focus()
    if (rules.length >= 20) return toast('Poți adăuga maximum 20 de reguli.')
    if (!rules.includes(t)) setRules(r => [...r, t]); setRuleIn(''); ruleRef.current.focus()
  }

  /* ---- Contract ---- */
  function pickContract(file) {
    if (!file) return
    if (!/\.(pdf|docx?|odt)$/i.test(file.name)) return setErrs(e => ({ ...e, contract: 'Fișierul trebuie să fie PDF, DOC, DOCX sau ODT.' }))
    if (file.size > 10 * 1024 * 1024) return setErrs(e => ({ ...e, contract: 'Fișierul e mai mare de 10 MB.' }))
    clear('contract'); setContract({ name: file.name, size: file.size, blob: file, url: URL.createObjectURL(file) })
  }

  function resetForm() {
    setF(empty()); setPhotos([]); setDays(new Set()); setCalKey(k => k + 1); setRules([]); setRuleIn(''); setContract(null); reset()
    pubGeo.current = null; geoSeq.current++; if (pubPin.current) { pubPin.current.remove(); pubPin.current = null } pubMap.current?.setView([45.9, 24.9], 6); setGeoInfo(GEO_HINT)
  }

  async function publish(riskAckAt) {
    const v = k => String(f[k]).trim()
    const ok = check({
      title: v('title') ? '' : 'Adaugă un titlu.',
      price: +v('price') > 0 ? '' : 'Introdu un preț mai mare decât 0.',
      area: +v('area') > 0 ? '' : 'Introdu suprafața în m².',
      county: v('county') ? '' : 'Alege județul.',
      city: v('city') ? '' : 'Scrie orașul sau localitatea.',
      address: v('address').length >= 5 ? '' : 'Scrie adresa: strada și numărul.',
      phone: !v('phone') ? 'Adaugă un număr de telefon.' : validPhone(v('phone')) ? '' : 'Număr invalid. Exemplu: 0722 123 456 sau +40 722 123 456.',
      access: f.access === 'custom' && f.from === f.to ? 'Ora de început și cea de sfârșit nu pot fi identice.' : '',
      uploader: photos.length ? '' : 'Adaugă cel puțin o poză cu spațiul. Fără poză anunțul nu poate fi publicat.',
      pubCal: days.size ? '' : 'Marchează cel puțin o zi în care spațiul e liber.',
      declare: f.declare ? '' : 'Bifează declarația ca să poți publica anunțul.',
    })
    if (!ok) return goToFirstInvalid('publishModal')
    if (!riskAckAt) return openM('risk')
    if (!pubGeo.current) { setBusy(true); await geocodeForm(false); setBusy(false) }
    const g = pubGeo.current || { lat: COUNTIES[v('county')][0], lng: COUNTIES[v('county')][1], approx: true }
    const x = {
      id: Date.now(), title: v('title'), type: f.type, price: +v('price'), unit: f.unit, area: +v('area'), county: v('county'), city: v('city'), location: locText(v('city'), v('county')), address: v('address'),
      lat: g.lat, lng: g.lng, geo: g.approx ? 'approx' : 'ok', avail: new Set(days),
      noise: f.noise.replace(/^.*până la /, '≤').replace('Fără limită specificată', 'Fără limită'), access: { custom: `${f.from}–${f.to}`, '24/7': '24/7', owner: 'Doar cu proprietarul' }[f.access], rules: [...rules], contract,
      imgs: photos.map(p => p.url), photoBlobs: photos.map(p => p.blob), desc: v('desc'),
      owner: { name: S.user.name, phone: v('phone'), since: String(new Date().getFullYear()), email: S.user.email },
      safety: { isu: f.isu, isuNo: f.isu ? v('isuNo') : '', extinguisher: f.ext, evacuation: f.evac, smoke: f.smoke },
      // Dovada declarației: în producție se salvează pe server împreună cu IP-ul și versiunea termenilor.
      declaration: { at: new Date(), termsVersion: TERMS_VERSION, riskWarning: { at: riskAckAt, valuablesRemoved: true, risksAssumed: true, platformNotLiable: true } },
    }
    x.img = x.imgs[0]
    publishListing(x); resetForm()
  }

  return (
    <Modal name="publish" id="publishModal">
      <div className="modalhead"><div><h2>Publică un spațiu</h2><div className="hint">Transformă un spațiu nefolosit într-o sursă de venit.</div></div><CloseBtn name="publish" /></div>
      <div className="formgrid">
        <Field full err={errs.title}><label htmlFor="fTitle">Titlu anunț *</label><input id="fTitle" ref={titleRef} value={f.title} onChange={set('title', 'title')} placeholder="ex. Garaj uscat pentru depozitare" /></Field>
        <div className="field"><label htmlFor="fType">Tip</label><select id="fType" value={f.type} onChange={set('type')}><option value="storage">Depozitare</option><option value="event">Evenimente</option><option value="work">Lucru</option><option value="leisure">Timp liber</option></select></div>
        <Field err={errs.price}><label htmlFor="fPrice">Preț *</label><input id="fPrice" type="number" min="1" placeholder="ex. 150" value={f.price} onChange={set('price', 'price')} /><span className="hint">lei / unitatea aleasă</span></Field>
        <Field err={errs.area}><label htmlFor="fArea">Suprafață (m²) *</label><input id="fArea" type="number" min="1" placeholder="ex. 30" value={f.area} onChange={set('area', 'area')} /></Field>
        <div className="field"><label htmlFor="fUnit">Unitate de preț</label><select id="fUnit" value={f.unit} onChange={set('unit')}><option>lună</option><option>zi</option><option>oră</option></select></div>
        <Field err={errs.county}><label htmlFor="fCounty">Județ *</label>
          <select id="fCounty" value={f.county} onChange={e => { set('county', 'county')(e); fRef.current = { ...fRef.current, county: e.target.value }; placeChanged() }}><option value="">Alege județul</option>{COUNTY_NAMES.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field err={errs.city}><label htmlFor="fCity">Oraș / localitate *</label><input id="fCity" value={f.city} onChange={e => { set('city', 'city')(e); dirty.current = true }} onBlur={onBlurPlace} placeholder={f.county === 'București' ? 'ex. Sector 3' : 'ex. Florești'} /></Field>
        <Field full err={errs.address}><label htmlFor="fAddress">Adresă (stradă, număr, bloc) *</label><input id="fAddress" autoComplete="street-address" value={f.address} onChange={e => { set('address', 'address')(e); dirty.current = true }} onBlur={onBlurPlace} placeholder="ex. Str. Avram Iancu nr. 12, bl. A, ap. 3" /><span className="hint">Apare în pagina anunțului și pe biletul de rezervare.</span></Field>
        <div className="field full"><label>Locația pe hartă</label><div className="pub-map" ref={mapEl} />
          <div className="geo-row"><span className="hint">{geoInfo}</span><button type="button" className="btn sm" onClick={() => geocodeForm(true)}>📍 Găsește adresa pe hartă</button></div></div>
        <Field err={errs.phone}><label htmlFor="fPhone">Telefon de contact *</label><input id="fPhone" type="tel" autoComplete="tel" placeholder="ex. 0722 123 456" value={f.phone} onChange={set('phone', 'phone')} /><span className="hint">Apare în pagina anunțului</span></Field>
        <div className="field"><label htmlFor="fNoise">Limită de zgomot</label><select id="fNoise" value={f.noise} onChange={set('noise')}>{NOISE.map(n => <option key={n}>{n}</option>)}</select></div>
        <Field full err={errs.access}><label htmlFor="fAccess">Program de acces</label>
          <select id="fAccess" value={f.access} onChange={e => { set('access')(e); if (e.target.value !== 'custom') clear('access') }}><option value="custom">Interval orar (alegi tu orele)</option><option value="24/7">Non-stop (24/7)</option><option value="owner">Doar cu proprietarul</option></select>
          {f.access === 'custom' && <>
            <div className="time-row"><span className="hint">De la</span><select value={f.from} onChange={set('from', 'access')} aria-label="De la ora">{HOURS.map(h => <option key={h}>{h}</option>)}</select><span className="hint">până la</span><select value={f.to} onChange={set('to', 'access')} aria-label="Până la ora">{HOURS_END.map(h => <option key={h}>{h}</option>)}</select></div>
            <span className="hint">Format 24 de ore. Intervalul poate trece peste miezul nopții, ex. 18:00 – 02:00.</span>
          </>}
        </Field>
        <Field full err={errs.uploader}><label>Fotografii *</label>
          <div className={`uploader${drag ? ' drag' : ''}`}
            onDragEnter={e => { e.preventDefault(); setDrag(true) }} onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={e => { e.preventDefault(); setDrag(false) }} onDrop={e => { e.preventDefault(); setDrag(false); addPhotos(e.dataTransfer.files) }}>
            {photos.map((ph, i) => (
              <div key={ph.url} className="ph" role="button" tabIndex={0} title={i ? 'Fă copertă' : 'Copertă'} style={{ backgroundImage: `url('${ph.url}')` }} onClick={() => makeCover(i)}>
                {i === 0 && <span className="cover">Copertă</span>}
                <button className="rm" aria-label="Șterge poza" onClick={e => { e.stopPropagation(); setPhotos(p => p.filter((_, k) => k !== i)) }}>×</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && <label className="add-photo" htmlFor="fPhotos" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoIn.current.click() } }}>＋<span>Adaugă poze</span></label>}
          </div>
          <input id="fPhotos" ref={photoIn} type="file" accept="image/*" multiple hidden onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
          <span className="hint">Până la 10 poze, le poți și trage aici. Prima e coperta și apare în bula de pe hartă; apasă pe o poză ca s-o faci copertă.</span>
        </Field>
        <div className="field full"><label htmlFor="fDesc">Descriere</label><textarea id="fDesc" rows="3" value={f.desc} onChange={set('desc')} placeholder="Ce poate face chiriașul aici? Ce restricții există?" /></div>

        <div className="section-title">📅 Când e liber spațiul * <span className="hint">· apasă pe zile sau trage peste ele ca să le marchezi</span></div>
        <Field full err={errs.pubCal}><Calendar key={calKey} mode="edit" days={days} onChange={d => { setDays(d); if (d.size) clear('pubCal') }} /></Field>

        <div className="section-title">🧯 Siguranță la incendiu <span className="hint">· bifează doar ce poți dovedi cu documente</span></div>
        <div className="field full"><div className="checkgrid">
          <label className="check"><input type="checkbox" checked={f.isu} onChange={set('isu')} /><span><b>Autorizat ISU</b><small>Autorizație / aviz de securitate la incendiu</small></span></label>
          <label className="check"><input type="checkbox" checked={f.ext} onChange={set('ext')} /><span><b>Stingător de incendiu</b><small>Verificat și în termen de valabilitate</small></span></label>
          <label className="check"><input type="checkbox" checked={f.evac} onChange={set('evac')} /><span><b>Căi de evacuare</b><small>Ieșiri semnalizate, iluminat de siguranță</small></span></label>
          <label className="check"><input type="checkbox" checked={f.smoke} onChange={set('smoke')} /><span><b>Detector de fum / alarmă</b><small>Sistem de detectare funcțional</small></span></label>
        </div></div>
        {f.isu && <div className="field full"><label htmlFor="fIsuNo">Nr. și data autorizației ISU (opțional)</label><input id="fIsuNo" value={f.isuNo} onChange={set('isuNo')} placeholder="ex. 1234 din 15.03.2025" /></div>}

        <div className="section-title">📋 Reguli ale casei <span className="hint">· opțional, apar în pagina anunțului</span></div>
        <div className="field full">
          <div className="rule-presets">{RULE_PRESETS.map(t => <button key={t} type="button" className={`chip${rules.includes(t) ? ' active' : ''}`} onClick={() => togglePreset(t)}>{t}</button>)}</div>
          <div className="rule-add"><input ref={ruleRef} maxLength={150} value={ruleIn} onChange={e => setRuleIn(e.target.value)} placeholder="Scrie o regulă proprie, ex. Pantofii se lasă la intrare" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRule() } }} /><button type="button" className="btn" onClick={addRule}>Adaugă</button></div>
          <ul className="rule-list">{rules.map((t, i) => <li key={t}><span>{t}</span><button type="button" aria-label="Șterge regula" onClick={() => setRules(r => r.filter((_, k) => k !== i))}>×</button></li>)}</ul>
        </div>

        <div className="section-title">📄 Contract de închiriere <span className="hint">· opțional</span></div>
        <Field full err={errs.contract}>
          <div className="file-box">
            <span style={{ fontSize: 22 }}>📄</span>
            {contract ? <>
              <span className="fname"><b>{contract.name}</b><br /><span className="hint">{fmtSize(contract.size)}</span></span>
              <label className="btn sm" htmlFor="fContract">Înlocuiește</label><button type="button" className="btn sm danger" onClick={() => setContract(null)}>Șterge</button>
            </> : <>
              <span className="fname hint">Niciun contract atașat.</span><label className="btn sm" htmlFor="fContract">Atașează contractul</label>
            </>}
          </div>
          <input type="file" id="fContract" ref={contractIn} hidden accept=".pdf,.doc,.docx,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text" onChange={e => { pickContract(e.target.files[0]); e.target.value = '' }} />
          <span className="hint">PDF, DOC, DOCX sau ODT, maximum 10 MB. Chiriașii îl pot descărca din pagina anunțului.</span>
        </Field>

        <div className="section-title">Declarație *</div>
        <Field full err={errs.declare}><label className="check declare"><input type="checkbox" checked={f.declare} onChange={set('declare', 'declare')} /><span>Declar pe propria răspundere că informațiile din acest anunț, inclusiv cele privind siguranța la incendiu, sunt reale, că <b>îmi asum toate riscurile</b> legate de închirierea acestui spațiu și că <b>suport toate consecințele legale</b> ce decurg din aceasta. Confirm că am citit și accept <a href="#" onClick={e => { e.preventDefault(); openTerms(() => { setF(o => ({ ...o, declare: true })); clear('declare') }) }}>Termenii și condițiile</a>.</span></label></Field>
      </div>
      <div className="form-actions"><span className="hint">Câmpurile cu * sunt obligatorii.</span><button className="btn" onClick={() => closeM('publish')}>Anulează</button><button className="btn primary" disabled={busy} onClick={() => publish(null)}>{busy ? 'Caut adresa pe hartă…' : 'Publică anunțul'}</button></div>
      {createPortal(<RiskModal onConfirm={publish} />, document.body)}
    </Modal>
  )
}
