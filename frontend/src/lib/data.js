import { addDays, dKey } from './utils'

/* Anunțurile demo cu care pornește site-ul. */
export function seedListings() {
  const listings = [
    {id:1,title:"Garaj mare pentru depozitare",type:"storage",price:350,unit:"lună",area:32,location:"București · Titan",lat:44.421,lng:26.154,noise:"≤55 dB",access:"24/7",img:"https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",desc:"Spațiu uscat, securizat, acces cu mașina.",
      owner:{name:"Andrei Popescu",phone:"0700 000 101",since:"2023"},safety:{isu:false,isuNo:"",extinguisher:true,evacuation:false,smoke:false}},
    {id:2,title:"Casă cu curte pentru petreceri",type:"event",price:750,unit:"zi",area:180,location:"București · Băneasa",lat:44.512,lng:26.079,noise:"≤80 dB",access:"10:00–01:00",img:"https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=800&q=80",desc:"Curte mare, terasă și bucătărie. Potrivită pentru evenimente private.",
      owner:{name:"Maria Ionescu",phone:"0700 000 102",since:"2022"},safety:{isu:true,isuNo:"2107 din 12.05.2025",extinguisher:true,evacuation:true,smoke:true}},
    {id:3,title:"Boxă de depozitare securizată",type:"storage",price:180,unit:"lună",area:12,location:"București · Militari",lat:44.433,lng:26.006,noise:"Fără limită",access:"24/7",img:"https://images.unsplash.com/photo-1601584115197-04ecc0da31d8?auto=format&fit=crop&w=800&q=80",desc:"Boxă individuală, cameră supravegheată video.",
      owner:{name:"Radu Stan",phone:"0700 000 103",since:"2024"},safety:{isu:true,isuNo:"",extinguisher:true,evacuation:true,smoke:true}},
    {id:4,title:"Studio pentru lucru / foto",type:"work",price:120,unit:"oră",area:55,location:"București · Centru",lat:44.435,lng:26.101,noise:"≤65 dB",access:"08:00–22:00",img:"https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80",desc:"Studio luminos cu Wi-Fi rapid, mese și fundal foto.",
      owner:{name:"Ioana Dumitru",phone:"0700 000 104",since:"2023"},safety:{isu:true,isuNo:"",extinguisher:true,evacuation:true,smoke:false}},
    {id:5,title:"Curte privată pentru activități",type:"leisure",price:300,unit:"zi",area:400,location:"București · Otopeni",lat:44.548,lng:26.072,noise:"≤65 dB",access:"09:00–22:00",img:"https://images.unsplash.com/photo-1558521958-0a228e77e984?auto=format&fit=crop&w=800&q=80",desc:"Spațiu verde privat pentru grupuri mici și activități.",
      owner:{name:"Mihai Georgescu",phone:"0700 000 105",since:"2024"},safety:{isu:false,isuNo:"",extinguisher:true,evacuation:false,smoke:false}},
    {id:6,title:"Depozit 80 m² cu acces auto",type:"storage",price:900,unit:"lună",area:80,location:"București · Chitila",lat:44.478,lng:25.974,noise:"Fără limită",access:"24/7",img:"https://images.unsplash.com/photo-1586528116493-da8b7c3d6b2d?auto=format&fit=crop&w=800&q=80",desc:"Ideal pentru materiale, mobilier sau marfă. Acces auto direct.",
      owner:{name:"Cristina Matei",phone:"0700 000 106",since:"2021"},safety:{isu:true,isuNo:"",extinguisher:true,evacuation:true,smoke:false}},
  ]
  listings.forEach(x => x.imgs = [x.img])
  listings[1].rules = ['Fumatul doar în curte', 'Muzica se oprește la ora 01:00', 'Spațiul se predă curat']
  listings[3].rules = ['Pantofii se lasă la intrare'];
  ['Str. Liviu Rebreanu nr. 17, Sector 3', 'Str. Nordului nr. 52, Sector 1', 'Bd. Iuliu Maniu nr. 104, Sector 6', 'Str. Academiei nr. 9, Sector 3', 'Str. Zborului nr. 21', 'Str. Gării nr. 8'].forEach((a, i) => listings[i].address = a)
  /* Disponibilitate demo: următoarele 120 de zile, cu câteva zile ocupate. */
  listings.forEach(x => {
    x.county = 'București'; x.avail = new Set()
    for (let i = 0; i < 120; i++) { const d = addDays(new Date(), i); if (x.type === 'storage' || (i * 7 + x.id * 3) % 10 > 2) x.avail.add(dKey(d)) }
  })
  return listings
}

export const SEED_PLACE = [['București', 'Sector 3'], ['București', 'Sector 1'], ['București', 'Sector 6'], ['București', 'Sector 3'], ['Ilfov', 'Otopeni'], ['Ilfov', 'Chitila']]

export const SEED_REVIEWS = [
  [1,'Elena M.',5,5,'Garaj curat și uscat, acces ușor cu mașina. Andrei a răspuns repede la mesaje.','2026-08-14'],
  [1,'Vlad C.',4,5,'Exact ce scria în anunț. Ușa e puțin grea, dar în rest totul perfect.','2026-07-02'],
  [2,'Ioana T.',5,5,'Am făcut aici ziua de naștere a fiicei mele. Curtea e superbă, Maria a fost foarte de treabă.','2026-09-06'],
  [2,'Radu P.',4,4,'Spațiu foarte bun pentru petreceri. Parcarea e cam mică pentru mulți invitați.','2026-08-23'],
  [2,'Cristi D.',5,5,'Totul impecabil, ne întoarcem sigur.','2026-06-30'],
  [3,'Mihaela S.',4,4,'Boxă sigură, cu cameră. Programul non-stop e un mare plus.','2026-09-11'],
  [4,'Andreea F.',5,5,'Lumină naturală excelentă pentru fotografie. Recomand!','2026-09-20'],
  [4,'George L.',5,4,'Studio foarte bine echipat, Wi-Fi rapid.','2026-08-05'],
  [5,'Bianca R.',4,5,'Curte mare și liniștită, am organizat un picnic pentru firmă.','2026-07-19'],
  [6,'Sorin N.',5,5,'Am depozitat mobila pe durata renovării. Acces auto direct, foarte practic.','2026-05-28'],
].map(([lid, name, st, hs, txt, d], i) => ({ id: 'seedr' + i, type: 'listing', bookingId: null, listingId: lid, ownerKey: null, authorName: name, authorEmail: null, stars: st, hostStars: hs, comment: txt, createdAt: new Date(d + 'T12:00') }))
