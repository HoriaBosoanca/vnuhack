import { useEffect } from 'react'
import { useStore, S, closeM } from '../lib/store'
import { Modal, CloseBtn } from './ui'

export default function TermsModal() {
  const s = useStore(), open = s.ui.open.terms, accept = s.ui.termsAccept
  useEffect(() => { if (open) document.getElementById('termsBox').scrollTop = 0 }, [open])
  return (
    <Modal name="terms" id="termsModal" boxId="termsBox">
      <div className="modalhead"><div><h2>Termeni și condiții</h2><div className="hint">Versiunea 1.0, actualizată la 4 octombrie 2026</div></div><CloseBtn name="terms" /></div>
      <div className="terms-body">
        <h3>1. Ce este SPAȚIU</h3>
        <p>Platforma SPAȚIU este operată de [Denumire societate SRL], cu sediul în [adresă], CUI [număr], înregistrată la Registrul Comerțului sub nr. [număr] („SPAȚIU”). SPAȚIU pune în legătură persoanele care oferă spații spre închiriere („Proprietari”) cu persoanele care vor să le folosească temporar („Chiriași”).</p>
        <p>SPAȚIU acționează doar ca intermediar. Nu deține, nu administrează și nu inspectează spațiile și nu este parte în înțelegerile încheiate între utilizatori.</p>
        <h3>2. Contul de utilizator</h3>
        <p>Pentru a publica anunțuri sau a trimite mesaje trebuie să îți creezi un cont și să accepți acești Termeni. Trebuie să ai cel puțin 18 ani. Te obligi să furnizezi date reale, să le ții la zi și să păstrezi parola confidențială. Ești responsabil pentru tot ce se întâmplă din contul tău.</p>
        <h3>3. Obligațiile Proprietarilor</h3>
        <p>Prin publicarea unui anunț, Proprietarul declară că are dreptul legal de a închiria spațiul (ca proprietar, chiriaș cu drept de subînchiriere sau împuternicit) și că informațiile publicate — suprafață, preț, program de acces, limită de zgomot, fotografii — sunt reale și complete.</p>
        <p>Proprietarul respectă legislația aplicabilă, inclusiv regulile de urbanism, regulamentul asociației de proprietari și obligațiile fiscale privind veniturile din chirii.</p>
        <h3>4. Siguranța la incendiu (ISU)</h3>
        <p>Proprietarul este singurul responsabil pentru respectarea obligațiilor de apărare împotriva incendiilor prevăzute de Legea nr. 307/2006 și de reglementările conexe, inclusiv pentru obținerea autorizației sau avizului de securitate la incendiu acolo unde legea o cere pentru tipul de activitate și numărul de persoane.</p>
        <p>Informațiile despre autorizația ISU, stingătoare, căi de evacuare și sisteme de detectare sunt declarate de Proprietar pe propria răspundere. SPAȚIU nu verifică aceste documente. Proprietarul trebuie să le prezinte la cererea Chiriașului sau a SPAȚIU. Recomandăm Chiriașilor să ceară documentele înainte de închiriere, mai ales pentru evenimente cu public.</p>
        <h3>5. Asumarea riscurilor și a răspunderii</h3>
        <p>La publicarea fiecărui anunț, Proprietarul bifează o declarație prin care confirmă că își asumă toate riscurile legate de închirierea spațiului și că suportă toate consecințele legale ce decurg din aceasta.</p>
        <p>Proprietarul răspunde integral pentru prejudiciile cauzate Chiriașilor sau terților prin informații false ori incomplete sau prin nerespectarea obligațiilor legale și se obligă să despăgubească SPAȚIU pentru orice pretenție a terților legată de anunțul său. Declarațiile false pot atrage răspunderea civilă, contravențională sau penală, după caz.</p>
        <p>Înainte de publicare, Proprietarul confirmă într-o fereastră de avertizare separată că a îndepărtat sau a pus în siguranță bunurile de valoare din spațiu și că SPAȚIU nu răspunde pentru pierderea, furtul sau deteriorarea acestora ori pentru alte incidente legate de spațiu, în limitele permise de lege.</p>
        <h3>6. Obligațiile Chiriașilor</h3>
        <p>Chiriașul folosește spațiul doar pentru scopul convenit, respectă capacitatea maximă, limita de zgomot, programul de acces și regulile Proprietarului și predă spațiul în starea în care l-a primit. Chiriașul răspunde pentru pagubele produse de el sau de invitații săi.</p>
        <h3>7. Limitarea răspunderii SPAȚIU</h3>
        <p>În limitele permise de lege, SPAȚIU nu răspunde pentru starea, siguranța sau legalitatea spațiilor, pentru exactitatea informațiilor publicate de utilizatori, pentru accidente, incendii, furturi sau alte evenimente produse în spațiile închiriate și nici pentru neexecutarea înțelegerilor dintre utilizatori. Limitarea nu se aplică acolo unde legea nu permite excluderea răspunderii, de exemplu în caz de intenție sau culpă gravă.</p>
        <h3>8. Plăți, comisioane și anulări</h3>
        <p>Prețurile sunt stabilite de Proprietari. Modalitățile de plată, eventualele comisioane și politica de anulare sunt afișate înainte de confirmarea oricărei rezervări. După plată, Chiriașul primește un bilet de rezervare care servește ca dovadă de plată.</p>
        <p>Rezervarea poate fi anulată din „Contul meu” până în ziua de început a perioadei rezervate, inclusiv, cu rambursarea integrală a sumei plătite. [De completat: procesatorul de plăți și termenul de rambursare.]</p>
        <h3>9. Mesageria</h3>
        <p>Mesageria se folosește doar pentru discuții legate de închirierea spațiilor. Sunt interzise spamul, hărțuirea, limbajul ofensator și tentativele de fraudă. SPAȚIU poate analiza conversațiile raportate și poate suspenda conturile care încalcă aceste reguli. Nu trimite bani în avans înainte de a vedea spațiul și documentele lui.</p>
        <h3>10. Conținut interzis</h3>
        <p>Nu sunt permise anunțurile false sau duplicate, anunțurile pentru spații asupra cărora nu ai drept de folosință și anunțurile pentru activități ilegale. SPAȚIU poate elimina orice anunț care încalcă acești Termeni.</p>
        <h3>11. Datele personale</h3>
        <p>Prelucrăm datele personale conform Regulamentului (UE) 2016/679 (GDPR) și Politicii de confidențialitate. Numele și numărul de telefon introduse într-un anunț sunt vizibile celorlalți utilizatori. Ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție, pe care le poți exercita la [adresa de e-mail], precum și dreptul de a depune plângere la ANSPDCP.</p>
        <h3>12. Modificarea Termenilor</h3>
        <p>Putem modifica acești Termeni. Te anunțăm înainte ca modificările importante să intre în vigoare; dacă folosești platforma în continuare după acea dată, accepți noua versiune.</p>
        <h3>13. Legea aplicabilă și litigii</h3>
        <p>Acești Termeni sunt guvernați de legea română. Neînțelegerile se rezolvă întâi pe cale amiabilă, iar în caz contrar de instanțele competente din România. Consumatorii se pot adresa și Autorității Naționale pentru Protecția Consumatorilor (ANPC).</p>
        <h3>14. Contact</h3>
        <p>[Denumire societate SRL], [adresă], [e-mail], [telefon].</p>
      </div>
      <div className="form-actions sticky">
        <button className="btn" onClick={() => closeM('terms')}>Închide</button>
        {accept && <button className="btn primary" onClick={() => { const fn = S.ui.termsAccept; closeM('terms'); fn && fn() }}>Am citit și accept</button>}
      </div>
    </Modal>
  )
}
