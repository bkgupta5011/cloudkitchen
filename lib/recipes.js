// ═══════════════════════════════════════════════════════════════════
//  FoodFi Cloud Kitchen — Master Recipe Book
//  Chef: Saif | Location: Patna, Bihar
//  All quantities per 100g main ingredient (scale accordingly)
// ═══════════════════════════════════════════════════════════════════

export const RECIPE_CATEGORIES = ['Sab Recipes', 'Curries & Sabzi', 'Chawal (Rice)', 'Roti & Puri', 'Add-Ons']

export const RECIPES = [

  // ═══════════════════════════════════════════════════════
  //  CURRIES & SABZI
  // ═══════════════════════════════════════════════════════

  {
    id: 'rajma',
    name: 'Rajma',
    emoji: '🫘',
    category: 'Curries & Sabzi',
    usedIn: ['Rajma Rice Bowl', '5 Roti with Rajma', '6 Puri with Rajma', 'Rajma Tadka', 'Extra Rajma'],
    prepTime: '8 ghante (bhigona)',
    cookTime: '50 minute',
    batchYield: '100g dry rajma = 2 full portions',
    description: 'Punjabi-Bihar style dark aur rich rajma curry. Thick gravy mein slow-cooked kidney beans. Patna mein sabse zyada order hone wali dish. Dark color aur strong masala iska signature hai.',

    ingredients: [
      { name: 'Rajma (lal, mota size)',       qty: '100g',  note: '8-12 ghante pani mein bhigo ke rakhein' },
      { name: 'Pyaaz (barik kata)',            qty: '60g',   note: 'Deep golden brown tak zaroor bhunein' },
      { name: 'Tamatar (puree kiya hua)',      qty: '80g',   note: 'Fresh, mixi mein smooth pees lein' },
      { name: 'Adrak paste (fresh)',           qty: '10g',   note: 'Ek hafte mein use karein — fresh grind best' },
      { name: 'Lahsun paste (fresh)',          qty: '8g',    note: 'Fresh grind' },
      { name: 'Sarson ka tel',                 qty: '20ml',  note: 'Bihar ka signature — refine oil se alag taste' },
      { name: 'Ghee (desi)',                   qty: '5g',    note: 'Final step mein dalna — optional par recommended' },
      { name: 'Pani (cooking ke liye)',        qty: '300ml', note: 'Pressure cooking ke liye' },
    ],

    spices: [
      { name: 'Jeera (sabut cumin)',  qty: '2g',     note: 'Tadka ke liye' },
      { name: 'Tej patta',            qty: '1 patta', note: '' },
      { name: 'Badi elaichi (kali)',  qty: '1 piece', note: 'Thoda crush karein' },
      { name: 'Dalchini',             qty: '2g',     note: 'Ek chhoti stick' },
      { name: 'Haldi powder',         qty: '3g',     note: '' },
      { name: 'Lal mirch powder',     qty: '4g',     note: 'Kashmiri + regular milake' },
      { name: 'Dhaniya powder',       qty: '8g',     note: '' },
      { name: 'Garam masala',         qty: '3g',     note: 'Ant mein dalna' },
      { name: 'Aamchur powder',       qty: '2g',     note: 'Tanginess ke liye' },
      { name: 'Namak',                qty: '6g',     note: 'Ya swadanusaar' },
    ],

    steps: [
      { num: 1, title: 'Bhigoana (Soaking)', detail: 'Rajma ko raat bhar (8-12 ghante) thande pani mein bhigo ke rakhein. Soaked rajma ka volume almost double ho jaata hai. Bhigone ke baad iska pani phek dein aur fresh pani use karein cooking ke liye.' },
      { num: 2, title: 'Pressure Cooking', detail: 'Bhige rajma ko pressure cooker mein fresh pani (300ml) + namak (2g) + tej patta + badi elaichi ke saath dalein. HIGH flame par 5-6 seeti lagayein. Aanch band karein aur pressure khud kam hone dein. Rajma bilkul naram hona chahiye — finger se press karne par crush ho jaye. Agar hard hai toh 2-3 seeti aur lagayein.' },
      { num: 3, title: 'Sarson Tel Garam Karna', detail: 'Ek thick-bottom kadai/patila mein sarson ka tel SMOKING POINT tak garam karein (dhuan nikle). Phir aanch bilkul dhimi karein aur 30-40 seconds ke liye tel ko thanda hone dein. Yeh step mustard oil ka kachapan (raw taste) khatam karta hai — skip mat karein.' },
      { num: 4, title: 'Sabut Masale', detail: 'Jeera, badi elaichi, dalchini dalein. 30-40 seconds crackle hone dein jab tak jeera sizzle kare. Tej patta bhi daalein.' },
      { num: 5, title: 'Pyaaz Bhunna ★ Most Critical Step', detail: 'Pyaaz dalein. MEDIUM-HIGH aanch par 12-15 minute tak bhunein jab tak DEEP GOLDEN BROWN color aaye. Beech beech mein hilaate rahein. Yeh step directly rajma ke color aur richness decide karta hai. Patna style mein dark golden pyaaz chahiye — is step ko kabhi skip ya short na karein.' },
      { num: 6, title: 'Adrak-Lahsun', detail: 'Adrak-lahsun paste dalein. Medium aanch par 3-4 minute cook karein jab tak raw smell poori tarah khatam ho jaye. Paste thoda brown hone lage toh achha signal hai.' },
      { num: 7, title: 'Tamatar Masala', detail: 'Tamatar puree dalein. MEDIUM aanch par cook karein jab tak masala tel chhodne lage (sides par tel dikhne lage) — 8-10 minute lagenge. Yeh bahut important step hai: kachcha masala khana kharab karta hai. Tamatar ka raw smell bilkul nahi rehna chahiye.' },
      { num: 8, title: 'Dry Masale Bhunna', detail: 'Haldi + lal mirch + dhaniya powder dalein. 2 minute medium aanch par bhunein. Jalne se bachne ke liye beech mein 1-2 tbsp pani chhidkein — masala stick karne lage toh foran pani daalein.' },
      { num: 9, title: 'Rajma Milana', detail: 'Boiled rajma ko APNE PANI (cooking water) ke saath daalen. Yeh cooking water rajma ki richness add karta hai — phekein mat. Achhi tarah mix karein.' },
      { num: 10, title: 'Gravy Thick Karna', detail: 'Ek ladle se 3-4 tbsp rajma nikaalo, alag bowl mein haath ya chamche se mash karo, wapas daalo. Isse gravy thick aur creamy ho jaati hai bina koi extra ingredient ke.' },
      { num: 11, title: 'Simmer', detail: 'Dhimi aanch par dhakkan lagakar 20 minute simmmer karein. Darmiyan mein 2-3 baar hilaate rahein. Consistency adjust karein — zyada thick lage toh thoda warm pani dalein.' },
      { num: 12, title: 'Final Masale', detail: 'Garam masala + aamchur + ghee dalein. Achhi tarah mix karein. 5 minute dhimi aanch par pakayein. Taste check karein — namak, khattaas, teekha adjust karein.' },
      { num: 13, title: 'Garnish', detail: 'Aanch band karein. Fresh hara dhaniya + thin adrak julienne (adrak ke lambe pateele tukde) se garnish karein. Serving se pehle 5 minute resting time dein.' },
    ],

    serving: 'Ek portion = 150-170g rajma. Rice bowl mein: pehle 150g steamed rice bowl mein, phir rajma upar se daalein. Roti combo mein: rajma alag container/bowl mein dein. 5 rotis side mein. Garnish: hara dhaniya + adrak julienne + ghee ki ek thread. Side mein: green chutney + raita (optional). Lemon wedge saath dein — Patna mein log squeeze karke khaate hain.',

    tips: [
      '★ Patna style: Rajma DARK color ka hona chahiye. Pyaaz ko properly deep golden tak bhunna hi iska secret hai.',
      '★ Mustard oil use karna Bihar ka signature hai — refined oil se woh authentic taste nahi milegi.',
      'Quality check: Rajma finger se press karne par smooth mash hona chahiye — agar hard hai toh aur pressure cook karein.',
      'Batch cooking: 500g dry rajma ek saath banaein. 6-8 ghante room temp par fresh rehta hai. Refrigerated: 2 din.',
      'Aamchur se tanginess aati hai jo Bihar mein bahut pasand hai — adjust to taste.',
      'Secret tip: Ant mein ek chutki kasoori methi (haath se crush karke) daalne se restaurant-style flavor aata hai.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'chole',
    name: 'Chole / Masala Chole',
    emoji: '🍛',
    category: 'Curries & Sabzi',
    usedIn: ['Classic Chole Rice', '5 Roti with Chole', '6 Puri with Chole', 'Masala Chole', 'Chana (base)'],
    prepTime: '10 ghante (bhigona)',
    cookTime: '60 minute',
    batchYield: '100g dry chana = 2-3 portions',
    description: 'Amritsari-style Punjabi chole jo Patna ke taste ke liye adapt kiya gaya hai. Tea se dark color, anardana aur aamchur se sourness, aur thick spiced gravy. Yeh FoodFi ki bestseller dish hai.',

    ingredients: [
      { name: 'Kabuli chana (bade size, light color)', qty: '100g', note: '8-10 ghante bhigo ke rakhein' },
      { name: 'Kali chai ki patti (tea bag)',           qty: '1 bag', note: 'DARK COLOR KA RAAZ — skip mat karein!' },
      { name: 'Pyaaz (barik kata)',                    qty: '70g',  note: '' },
      { name: 'Tamatar (puree)',                        qty: '90g',  note: 'Fresh, smooth puree' },
      { name: 'Adrak paste',                           qty: '12g',  note: 'Thoda zyada adrak chole mein acha lagta hai' },
      { name: 'Lahsun paste',                          qty: '10g',  note: '' },
      { name: 'Sarson ka tel',                         qty: '25ml', note: '' },
      { name: 'Imli paste ya aamchur',                 qty: '5g',   note: 'Signature tanginess ke liye' },
    ],

    spices: [
      { name: 'Jeera sabut',             qty: '2g',      note: '' },
      { name: 'Tej patta',               qty: '1 leaf',  note: '' },
      { name: 'Laung (cloves)',          qty: '2 pieces', note: 'Cooking mein dalna' },
      { name: 'Badi elaichi',            qty: '1 piece', note: '' },
      { name: 'Kali mirch (sabut)',      qty: '4 pieces', note: '' },
      { name: 'Haldi',                   qty: '2g',      note: 'Chole mein kam haldi — color tea se aata hai' },
      { name: 'Lal mirch powder',        qty: '5g',      note: '' },
      { name: 'Dhaniya powder',          qty: '8g',      note: '' },
      { name: 'Chole masala (readymade)', qty: '8g',     note: 'MDH ya Everest chole masala best hai' },
      { name: 'Aamchur powder',          qty: '4g',      note: '' },
      { name: 'Anardana powder',         qty: '3g',      note: 'AMRITSARI SECRET — pomegranate seed powder, unique tang' },
      { name: 'Namak',                   qty: '6g',      note: '' },
    ],

    steps: [
      { num: 1, title: 'Bhigoana', detail: 'Kabuli chana ko 8-10 ghante (raat bhar) bhigo lein. Volume double ho jaata hai. Bhigone ka pani phekein.' },
      { num: 2, title: 'Dark Color Ka Raaz ★', detail: 'Pressure cooker mein bhiga chana + fresh pani (350ml) + tea bag + laung + badi elaichi + namak dalein. HIGH flame par 6-7 seeti lagayein. Pressure khud release hone dein. Tea bag NIKAL LEIN — yeh chane ko beautiful dark brownish-black color deta hai jo Amritsari chole ki pehchaan hai. Chane ka cooking water BACHAYEIN — gravy ke liye use hoga.' },
      { num: 3, title: 'Masala Base', detail: 'Sarson ka tel smoking point tak garam karein, 30 seconds cool down.' },
      { num: 4, title: 'Sabut Masale', detail: 'Jeera + tej patta + kali mirch dalein — crackle hone dein.' },
      { num: 5, title: 'Pyaaz ★', detail: 'Pyaaz dalein, DARK GOLDEN color aane tak bhunein — 15 minute. Chole ke liye pyaaz aur bhi zyada dark chahiye rajma se. Dark pyaaz chole ke signature dark color mein add karta hai.' },
      { num: 6, title: 'Adrak-Lahsun', detail: 'Paste dalein, 4 minute cook karein.' },
      { num: 7, title: 'Tamatar', detail: 'Puree dalein, oil separate hone tak cook karein — 10 minute.' },
      { num: 8, title: 'Masale', detail: 'Haldi + lal mirch + dhaniya powder dalein — 2 minute bhunein.' },
      { num: 9, title: 'Chole Masala', detail: 'Readymade chole masala dalein — 1 minute bhunein (jalne se bachao).' },
      { num: 10, title: 'Chane Milana', detail: 'Boiled chane apne dark cooking water ke saath dalein. Mix karein.' },
      { num: 11, title: 'Simmer', detail: '20 minute medium-low aanch par simmmer karein. Beech mein hilaate rahein. Kuch chane mash ho jaayenge jo gravy thick karega.' },
      { num: 12, title: 'Aamchur + Anardana', detail: 'Aamchur + anardana powder dalein — yeh Amritsari taste ka core hai. Mix karein.' },
      { num: 13, title: 'Garnish', detail: 'Fresh hara dhaniya + ginger julienne + thin green chilli strips + onion rings se garnish karein.' },
    ],

    serving: 'Ek portion = 150-170g chole. Rice bowl mein: rice neeche, chole upar. Puri ke saath serve karte waqt: chole alag bowl mein, 6 crispy puris side mein. Garnish: hara dhaniya + adrak julienne + ek lemon wedge. Patna mein log lemon squeeze karna pasand karte hain — zaroor dein.',

    tips: [
      '★ Tea bag se dark color aata hai — yeh Amritsari chole ka main secret hai. KABHI SKIP MAT KAREIN.',
      '★ Anardana powder (pomegranate seed) — yeh ingredient chole ko ghar ke chole se alag banata hai. Market mein milta hai.',
      'Chole mein zyada tamatar daalein — yeh tanginess badhata hai jo Patna ke log pasand karte hain.',
      'Consistency: Chole ki gravy medium-thick rakhein — na bahut paatli na bahut thick.',
      'Ek lemon wedge saath dena zaroori hai — presentation aur taste dono ke liye.',
      'Batch tip: 500g chana ek saath banayein. Gravy alag rakhein — combine karte waqt garnish taaza karein.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'matar-chole',
    name: 'Matar Chole',
    emoji: '💚',
    category: 'Curries & Sabzi',
    usedIn: ['Matar Chola Rice'],
    prepTime: '8 ghante + 5 min',
    cookTime: '50 minute',
    batchYield: '100g chana + 50g matar = 2 portions',
    description: 'Kabuli chana aur hare matar ka combination. Chole ki richness ke saath matar ki freshness. Light green spots wali dish jo visually bhi attractive lagti hai.',

    ingredients: [
      { name: 'Kabuli chana (soaked)',   qty: '100g', note: 'Raat bhar bhigoke' },
      { name: 'Hara matar (frozen/fresh)', qty: '50g', note: 'LAST mein dalna — overcook mat karna' },
      { name: 'Pyaaz',                   qty: '60g',  note: '' },
      { name: 'Tamatar puree',           qty: '80g',  note: '' },
      { name: 'Adrak-lahsun paste',      qty: '15g',  note: '' },
      { name: 'Tel',                     qty: '20ml', note: '' },
    ],

    spices: [
      { name: 'Jeera',          qty: '2g',  note: '' },
      { name: 'Haldi',          qty: '3g',  note: '' },
      { name: 'Lal mirch',      qty: '4g',  note: '' },
      { name: 'Dhaniya powder', qty: '7g',  note: '' },
      { name: 'Aamchur',        qty: '3g',  note: '' },
      { name: 'Garam masala',   qty: '2g',  note: '' },
      { name: 'Namak',          qty: '5g',  note: '' },
    ],

    steps: [
      { num: 1, title: 'Chana Pakana', detail: 'Kabuli chana WITHOUT tea bag, 6 seeti mein pakayein. (Matar chole mein tea bag nahi — yahan light brownish color chahiye, dark nahi.)' },
      { num: 2, title: 'Standard Masala Base', detail: 'Tel garam karein. Jeera + pyaaz — medium golden (10 min). Adrak-lahsun — 3 min. Tamatar puree — oil separate hone tak (8 min).' },
      { num: 3, title: 'Masale', detail: 'Haldi + lal mirch + dhaniya dalein, 2 min bhunein.' },
      { num: 4, title: 'Chana Milana', detail: 'Boiled chana apne pani ke saath dalein. 10 minute simmer karein.' },
      { num: 5, title: 'Matar Add Karna ★', detail: 'LAST 5 MINUTE mein frozen/fresh matar dalein. Sirf itna pakao ki matar garam ho jaaye — GREEN COLOR AUR SHAPE BANANA CHAHIYE. Zyada pakane par matar mushy aur yellow ho jaate hain.' },
      { num: 6, title: 'Final', detail: 'Garam masala + aamchur dalein. Taste adjust karein.' },
    ],

    serving: 'Matar ka bright green color dikhna chahiye — yeh dish ki visual appeal hai. Rice bowl mein serve karein garnish ke saath.',

    tips: [
      '★ Matar KABHI zyada mat pakao — 5 minute se zyada nahi, warna green color khatam ho jaata hai.',
      'Frozen matar use karna best hai — fresh matar mein variation hota hai.',
      'Presentation tip: Serving ke time 2-3 matar upar se garnish karein.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'white-chana',
    name: 'White Chana (Kabuli Chana)',
    emoji: '⚪',
    category: 'Curries & Sabzi',
    usedIn: ['White Chana Rice Bowl', 'White Chana Tadka'],
    prepTime: '8 ghante',
    cookTime: '45 minute',
    batchYield: '100g dry = 2 portions',
    description: 'Chole se alag — yeh lighter masala wala, golden-yellow color ka dish hai. No tea bag, less spice, more aromatic. Un logon ke liye jo bahut heavy chole nahi chahte.',

    ingredients: [
      { name: 'Kabuli chana (medium size)', qty: '100g', note: 'Raat bhar bhigo ke' },
      { name: 'Pyaaz',                     qty: '50g',  note: 'Medium golden tak — dark nahi' },
      { name: 'Tamatar puree',             qty: '60g',  note: 'Thoda kam tamatar' },
      { name: 'Adrak-lahsun paste',        qty: '15g',  note: '' },
      { name: 'Refined tel (seedha)',      qty: '20ml', note: 'NOT mustard oil — lighter taste ke liye' },
    ],

    spices: [
      { name: 'Jeera',          qty: '2g', note: '' },
      { name: 'Haldi',          qty: '4g', note: 'Thodi zyada — golden color ke liye' },
      { name: 'Lal mirch',      qty: '3g', note: 'Thodi kam — lighter dish' },
      { name: 'Dhaniya powder', qty: '6g', note: '' },
      { name: 'Garam masala',   qty: '2g', note: '' },
      { name: 'Aamchur',        qty: '2g', note: '' },
      { name: 'Namak',          qty: '5g', note: '' },
    ],

    steps: [
      { num: 1, title: 'Pakana', detail: 'Chana WITHOUT tea bag, 6 seeti mein pakayein. Pani bachayein.' },
      { num: 2, title: 'Tel Garam', detail: 'Refined oil garam karein (mustard oil nahi).' },
      { num: 3, title: 'Pyaaz', detail: 'Medium golden tak bhunein (10 min) — deep brown nahi banana.' },
      { num: 4, title: 'Adrak-lahsun + Tamatar', detail: 'Standard process — 3 min + 8 min.' },
      { num: 5, title: 'Masale + Chana', detail: 'Masale dalein, 2 min. Phir chana apne pani ke saath dalein.' },
      { num: 6, title: 'Simmer + Finish', detail: '10-15 min simmer. Garam masala + aamchur ant mein.' },
    ],

    serving: 'Golden-yellow color wali dish. Rice ke saath best. Fresh dhaniya se garnish karein.',

    tips: [
      'Lighter taste ke liye refined oil hi use karein sarson tel nahi.',
      'Patna mein yeh dish thodi extra haldi se acha lagta hai — golden color attractive hai.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'mix-chole',
    name: 'Mix Chole (Teen Dal Combo)',
    emoji: '🥗',
    category: 'Curries & Sabzi',
    usedIn: ['Mix Protein Rice Bowl', '5 Roti with Mix Chole', '6 Puri with Mix Chole', 'Mix Chole Tadka', 'Extra Mix Chole'],
    prepTime: '8 ghante',
    cookTime: '60 minute',
    batchYield: '100g total mix = 2 portions',
    description: 'Rajma + Kabuli Chana + Kala Chana ka combination. Teen daalon ka flavor ek saath milne se yeh sabse unique aur protein-rich dish hai. FoodFi ki "hero dish" — jo dono order karte hain na rajma khaana chahte hain na sirf chole.',

    ingredients: [
      { name: 'Rajma (soaked)',          qty: '35g', note: 'Total mix ka ~35%' },
      { name: 'Kabuli chana (soaked)',   qty: '35g', note: 'Total mix ka ~35%' },
      { name: 'Kala chana (soaked)',     qty: '30g', note: 'Whole black gram — nutty flavor' },
      { name: 'Pyaaz',                   qty: '65g', note: 'Zyada masala chahiye teen dalon ke liye' },
      { name: 'Tamatar puree',           qty: '85g', note: '' },
      { name: 'Adrak-lahsun paste',      qty: '18g', note: '' },
      { name: 'Sarson ka tel',           qty: '22ml', note: '' },
    ],

    spices: [
      { name: 'Jeera',           qty: '2g',     note: '' },
      { name: 'Tej patta',       qty: '1 leaf', note: '' },
      { name: 'Badi elaichi',    qty: '1 piece', note: '' },
      { name: 'Haldi',           qty: '3g',     note: '' },
      { name: 'Lal mirch',       qty: '5g',     note: '' },
      { name: 'Dhaniya powder',  qty: '8g',     note: '' },
      { name: 'Garam masala',    qty: '3g',     note: '' },
      { name: 'Chole masala',    qty: '5g',     note: '' },
      { name: 'Aamchur',         qty: '3g',     note: '' },
      { name: 'Namak',           qty: '6g',     note: '' },
    ],

    steps: [
      { num: 1, title: 'Teen Dal Ek Saath Bhigona', detail: 'Teeno dalen alag-alag containers mein raat bhar bhigayein (ya ek hi container mein — 8 ghante). Rajma sabse zyada time lega pakne mein.' },
      { num: 2, title: 'Pressure Cook', detail: 'Teeno dalen ek saath pressure cooker mein dalein. Pani + namak. 7-8 seeti lagayein (rajma ke pakne ka time base hai). Check karein — teeno naram hone chahiye.' },
      { num: 3, title: 'Deep Masala Base', detail: 'Tel smoking point tak garam karein. Jeera + elaichi + tej patta — crackle. Pyaaz DEEP DARK GOLDEN tak bhunein — 15 min (teen dalon ke liye masala rich hona chahiye).' },
      { num: 4, title: 'Adrak-lahsun + Tamatar', detail: 'Standard — 4 min + 10 min.' },
      { num: 5, title: 'Masale', detail: 'Sab dry masale dalein. 2 min bhunein.' },
      { num: 6, title: 'Teen Dal Milana', detail: 'Teeno dalen apne pani ke saath dalein. Achhi tarah mix karein.' },
      { num: 7, title: 'Simmer + Chole Masala', detail: '20 min simmer karein. Beech mein chole masala dalein.' },
      { num: 8, title: 'Finish', detail: 'Garam masala + aamchur. Taste adjust.' },
    ],

    serving: 'Mix chole ka color naturally dark aur attractive hota hai. Teen daalon ki different textures dikhni chahiye. Generous garnish karein.',

    tips: [
      '★ Teen dalen sahi ratio mein rakho — rajma dominant nahi honi chahiye, sab equal dikhne chahiye.',
      'Mix chole ka flavor baaki sab se zyada rich hota hai — isliye slightly zyada masala use karein.',
      'Kala chana (black chickpea) ka nutty flavor unique dimension deta hai — substitute mat karein.',
      'Batch cooking: Teeno ek saath bhigo aur ek saath pakao — time bachine ke liye.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'dal-tadka',
    name: 'Dal Tadka',
    emoji: '🟡',
    category: 'Curries & Sabzi',
    usedIn: ['Dal Tadka Rice', '5 Roti with Dal Tadka', 'Dal Tadka'],
    prepTime: '30 min (no soaking needed)',
    cookTime: '40 minute',
    batchYield: '100g mixed dal = 2-3 portions',
    description: 'Classic yellow dal with SMOKY GHEE TADKA. Arhar aur moong dal ka combination. Ghee mein lahsun aur lal mirch ki tadka iska soul hai. Patna mein ghar ghar ki comfort food. Simple lekein bahut flavorful.',

    ingredients: [
      { name: 'Arhar / Toor dal',      qty: '60g',  note: 'Main dal' },
      { name: 'Moong dal (dhuli)',      qty: '40g',  note: 'Texture aur creaminess ke liye' },
      { name: 'Pyaaz (barik kata)',     qty: '40g',  note: 'Dal mein pyaaz medium golden' },
      { name: 'Tamatar (kata hua)',     qty: '50g',  note: '' },
      { name: 'Adrak paste',           qty: '8g',   note: '' },
      { name: 'Lahsun (puri kali)',     qty: '6 kaliyan', note: 'CRUSH KARKE — paste nahi, crushed' },
      { name: 'Ghee (desi) ★',          qty: '15g',  note: 'Dal tadka mein ghee essential hai — tel se nahi chalega' },
      { name: 'Tel',                   qty: '10ml', note: 'Initial masala ke liye' },
      { name: 'Pani',                  qty: '400ml', note: 'Dal ko paatla rakhein' },
    ],

    spices: [
      { name: 'Jeera (sabut)',            qty: '3g',    note: 'Tadka mein' },
      { name: 'Rai (mustard seeds)',      qty: '2g',    note: 'Tadka mein' },
      { name: 'Sookhi lal mirch (sabut)', qty: '2 pieces', note: 'Tadka mein' },
      { name: 'Hing (asafoetida) ★',      qty: '1 chutki', note: 'Dal tadka mein hing zaroori hai' },
      { name: 'Haldi',                   qty: '4g',    note: 'Thodi zyada — yellow color ke liye' },
      { name: 'Lal mirch powder',        qty: '3g',    note: 'Tadka mein bhi thodi' },
      { name: 'Garam masala',            qty: '2g',    note: 'Ant mein' },
      { name: 'Namak',                   qty: '5g',    note: '' },
      { name: 'Hara dhaniya',            qty: '10g',   note: 'Generous garnish' },
    ],

    steps: [
      { num: 1, title: 'Dal Pakana', detail: 'Arhar + moong dal ek saath wash karein. Pressure cooker mein dal + pani (400ml) + namak + haldi dalein. 3-4 seeti lagayein. Dal ekdum smooth aur silky honi chahiye.' },
      { num: 2, title: 'Masala Base', detail: 'Tel garam karein. Pyaaz MEDIUM GOLDEN tak bhunein (7-8 min — dal mein zyada dark nahi karna). Adrak paste dalein, 2 min.' },
      { num: 3, title: 'Tamatar', detail: 'Kata tamatar dalein. 5-6 min cook karein — fully mash ho jaaye.' },
      { num: 4, title: 'Spices + Dal', detail: 'Haldi + lal mirch dalein. Dal milayein. Consistency adjust karein — dal slightly thin rakhein (rice bowl ke saath yahi accha lagta hai). 5 min simmer.' },
      { num: 5, title: '★ TADKA — SABSE IMPORTANT STEP ★', detail: 'ALAG ek chhoti tadka pan mein ghee garam karein — SMOKING POINT TAK. FORAN daalein: jeera (phatne dein 10 sec) → rai (phatne dein) → hing → sookhi lal mirch → crushed lahsun (golden tak, 30 sec) → ek chutki lal mirch powder (5 sec) → TURANT PURI TADKA DAL KE UPAR DAAL DO. SIZZLING SOUND AAYEGI — yahi authentic tadka hai.' },
      { num: 6, title: 'Final', detail: 'Garam masala dalein. Taste check karein. Fresh dhaniya se garnish karein.' },
    ],

    serving: 'Dal paatli consistency mein serve karein (thick rice bowl ke liye nahi acchi lagti). Serving bowl mein dalein, upar se ek thread of fresh ghee + hara dhaniya. Tadka ka red-gold color upar dikhna chahiye — yeh visual ka important part hai.',

    tips: [
      '★ GHEE ki tadka use karo — sirf ghee se authentic smoky flavor aata hai, tel nahi.',
      '★ HING (heeng) zaroor daalein tadka mein — Bihar mein dal tadka mein hing standard hai.',
      '★ Lahsun CRUSH karke daalein, paste nahi — garlic chunks visible hona chahiye.',
      'Dal thodi paatli rakhein — na bahut thick na bilkul paani jaisi. Chawal ke saath perfect consistency.',
      'Tadka immediately use karein — thandi tadka ka flavor kam ho jaata hai.',
      'Arhar + moong combination best hai — sirf arhar se dal zyada heavy ho jaati hai.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'dal-fry',
    name: 'Dal Fry',
    emoji: '🟠',
    category: 'Curries & Sabzi',
    usedIn: ['6 Roti with Dal Fry', 'Dal Fry'],
    prepTime: '20 min (no soaking)',
    cookTime: '35 minute',
    batchYield: '100g masoor = 2 portions',
    description: 'Masoor dal (red lentils) ko rich fried masala mein pakaya hua. Dal fry, dal tadka se thick aur zyada fried style hai. Dhaba-style taste. Kasoori methi iska secret ingredient hai.',

    ingredients: [
      { name: 'Masoor dal (red lentils)', qty: '100g', note: 'Soak nahi karna — direct cook' },
      { name: 'Pyaaz (barik kata)',        qty: '55g',  note: '' },
      { name: 'Tamatar (kata)',            qty: '65g',  note: '' },
      { name: 'Adrak paste',              qty: '10g',  note: '' },
      { name: 'Lahsun paste',             qty: '8g',   note: '' },
      { name: 'Ghee ya Tel',              qty: '20ml', note: 'Ghee preferred for dhaba taste' },
    ],

    spices: [
      { name: 'Jeera',           qty: '2g',  note: '' },
      { name: 'Haldi',           qty: '4g',  note: '' },
      { name: 'Lal mirch',       qty: '4g',  note: '' },
      { name: 'Dhaniya powder',  qty: '6g',  note: '' },
      { name: 'Garam masala',    qty: '2g',  note: '' },
      { name: 'Kasoori methi ★', qty: '3g',  note: 'SECRET INGREDIENT — hand se crush karke dalna' },
      { name: 'Namak',           qty: '5g',  note: '' },
    ],

    steps: [
      { num: 1, title: 'Masoor Dal Pakana', detail: 'Masoor dal wash karein. Pressure cook (2-3 seeti) — zyada nahi pakana, thodi texture chahiye. Dal smooth ho par bilkul ghol nahi banana.' },
      { num: 2, title: 'FRYING STAGE ★', detail: 'Ghee/tel garam karein. Pyaaz GOLDEN BROWN tak bhunein — 10-12 min. Dal fry mein "frying" ka matlab hai properly fried masala — is par kanjoos mat bano.' },
      { num: 3, title: 'Adrak-lahsun', detail: '3 minute cook karein.' },
      { num: 4, title: 'Tamatar', detail: 'Dalein, oil separate hone tak — 8 min. Masala dry lag jaaye.' },
      { num: 5, title: 'Masale', detail: 'Sab dry masale dalein. 2 min bhunein.' },
      { num: 6, title: 'Dal Milana', detail: 'Cooked masoor dal dalein. Achhi tarah mix karein. THICK CONSISTENCY RAKHEIN — dal fry, dal tadka se thick hoti hai.' },
      { num: 7, title: 'Medium Fry', detail: 'Medium aanch par 8-10 min cook karein dhakkan ke bina — dal thodi fried honi chahiye.' },
      { num: 8, title: 'Kasoori Methi ★', detail: 'Aanch band karein. Kasoori methi ko haath se crush karke (palm mein ragadein) dal ke upar daalein. Mix karein. Ghee ki ek thread daalein.' },
    ],

    serving: 'Dal fry ki consistency thicker hogi dal tadka se. Roti ke saath best lagti hai. Serving mein ghee + dhaniya garnish.',

    tips: [
      '★ Kasoori methi haath se crush karke daalein — isse essential oil release hote hain, direct daalne se kam asar hota hai.',
      '★ Dal fry ki consistency thick rakhein — liquid nahi honi chahiye.',
      'Masoor dal ko ZYADA mat pakao — texture important hai.',
      'Ghee use karna dhaba taste ke liye essential hai.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'paneer-chole',
    name: 'Paneer Tadka / Paneer Chola',
    emoji: '🧀',
    category: 'Curries & Sabzi',
    usedIn: ['Paneer Chola Rice', '5 Roti with Paneer Chola', 'Paneer Tadka', 'Extra Paneer'],
    prepTime: '10 min',
    cookTime: '20 minute',
    batchYield: '100g paneer = 2-3 portions',
    description: 'Fresh paneer cubes chole gravy mein. Kashmiri lal mirch se deep red color, kasoori methi se aroma. Yeh basically chole gravy ka premium version hai paneer ke saath. Menu ka sabse costly item — quality maintain karein.',

    ingredients: [
      { name: 'Paneer (fresh, cubed 1.5cm)', qty: '100g',  note: 'Daily fresh lena — purana paneer kabhi nahi' },
      { name: 'Chole gravy (ready)',          qty: '200g',  note: 'Previously prepared chole base use karein' },
      { name: 'Pyaaz (extra tadka ke liye)', qty: '30g',   note: '' },
      { name: 'Tamatar puree',               qty: '40g',   note: '' },
      { name: 'Adrak-lahsun paste',          qty: '8g',    note: '' },
      { name: 'Tel ya Ghee',                qty: '15ml',  note: '' },
    ],

    spices: [
      { name: 'Haldi',                qty: '2g',    note: '' },
      { name: 'Lal mirch',            qty: '3g',    note: '' },
      { name: 'Kashmiri lal mirch ★', qty: '3g',    note: 'DEEP RED COLOR ke liye — regular mirch se alag hai' },
      { name: 'Chole masala',         qty: '4g',    note: '' },
      { name: 'Garam masala',         qty: '2g',    note: '' },
      { name: 'Kasoori methi',        qty: '2g',    note: '' },
      { name: 'Namak',                qty: '3g',    note: 'Already in chole — adjust karein' },
    ],

    steps: [
      { num: 1, title: 'Paneer Prep', detail: 'Paneer ko 1.5cm x 1.5cm cubes mein kaatein. Option: Tel mein light shallow fry karein golden tak (crispy outside, soft inside). Ya direct use karein gravy mein — dono acceptable hain. Frying se better texture milta hai.' },
      { num: 2, title: 'Extra Masala Base', detail: 'Tel/ghee garam karein. Pyaaz golden tak. Adrak-lahsun 2 min. Tamatar puree 5 min.' },
      { num: 3, title: 'Masale', detail: 'Haldi + lal mirch + Kashmiri mirch + chole masala dalein. 1 min bhunein.' },
      { num: 4, title: 'Chole Gravy Milana', detail: 'Prepared chole gravy dalein. Extra masala se mix karein.' },
      { num: 5, title: 'Paneer Add Karna ★', detail: 'Paneer cubes GENTLY milayein. SIRF 5 MINUTE SIMMER — zyada pakane par paneer RUBBER banta hai. Bas warm ho jaaye.' },
      { num: 6, title: 'Finish', detail: 'Kasoori methi (haath se crush) + garam masala. Taste check.' },
    ],

    serving: 'Paneer ke cubes intact dikhne chahiye — mashy nahi. Kashmiri lal mirch se beautiful deep red color. Rich garnish: dhaniya + adrak julienne.',

    tips: [
      '★ Paneer SIRF 5 min se zyada mat pakao — rubber ban jaata hai.',
      '★ Fresh paneer daily lena zaroori hai — day-old paneer ka texture kharab hota hai.',
      '★ Kashmiri lal mirch use zaroor karein — regular mirch se red color nahi aata.',
      'Paneer fry karna optional hai par strongly recommended — texture aur taste dono better hote hain.',
      'Yeh premium dish hai — presentation extra careful se karein.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'chana-tadka',
    name: 'Chana Tadka',
    emoji: '🫛',
    category: 'Curries & Sabzi',
    usedIn: ['Chana Tadka', '5 Roti with Tadka Chana'],
    prepTime: '8 ghante',
    cookTime: '40 minute',
    batchYield: '100g dry chana = 2 portions',
    description: 'Kabuli chana light tadka style mein. Chole se alag — yeh lighter masala, fresh garnish, zyada aromatic. Jab koi heavy chole nahi chahta par chana ka flavor chahta hai.',

    ingredients: [
      { name: 'Kabuli chana (soaked)', qty: '100g', note: '' },
      { name: 'Pyaaz',                qty: '45g',  note: 'Medium golden — dark nahi' },
      { name: 'Tamatar',              qty: '55g',  note: '' },
      { name: 'Adrak-lahsun paste',   qty: '15g',  note: 'Fresh' },
      { name: 'Ghee ya Tel',          qty: '18ml', note: 'Ghee preferred for tadka flavor' },
    ],

    spices: [
      { name: 'Jeera',               qty: '3g',       note: '' },
      { name: 'Sookhi lal mirch',    qty: '2 pieces', note: '' },
      { name: 'Haldi',               qty: '3g',       note: '' },
      { name: 'Lal mirch',           qty: '3g',       note: '' },
      { name: 'Dhaniya powder',      qty: '7g',       note: '' },
      { name: 'Garam masala',        qty: '2g',       note: '' },
      { name: 'Aamchur',             qty: '3g',       note: '' },
      { name: 'Hara dhaniya',        qty: '15g',      note: 'Generous fresh garnish' },
      { name: 'Adrak julienne',      qty: '5g',       note: 'Thin strips — garnish' },
      { name: 'Namak',               qty: '5g',       note: '' },
    ],

    steps: [
      { num: 1, title: 'Chana Pakana', detail: 'Without tea bag, 6 seeti. Pani bachao.' },
      { num: 2, title: 'Tadka Style', detail: 'Ghee/tel mein jeera + sookhi lal mirch — tadka sound aane dein.' },
      { num: 3, title: 'Pyaaz + Adrak-lahsun', detail: 'Medium golden tak (8-10 min). 3 min adrak-lahsun.' },
      { num: 4, title: 'Tamatar + Masale', detail: '7 min cook. Phir masale dalein.' },
      { num: 5, title: 'Chana', detail: 'Chana + pani dalein. 10 min simmer.' },
      { num: 6, title: 'Finish', detail: 'Aamchur + garam masala. FRESH garnish karein.' },
    ],

    serving: 'Chana tadka thoda dry-ish gravy mein achha lagta hai (extra chhana hua). Fresh dhaniya + adrak julienne ka generous garnish.',

    tips: ['Light aur fresh rakhein — heavy masala is dish ka charm kharab karta hai.'],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'rajma-tadka',
    name: 'Rajma Tadka',
    emoji: '🫘✨',
    category: 'Curries & Sabzi',
    usedIn: ['Rajma Tadka'],
    prepTime: '8 ghante',
    cookTime: '55 minute',
    batchYield: '100g dry rajma = 2 portions',
    description: 'Base rajma curry + serving ke waqt fresh ghee tadka upar se. Yeh regular rajma ka upgraded version hai — extra ghee tadka presentation ko restaurant-level bana deta hai.',

    ingredients: [],  // Same as Rajma base — refer to Rajma recipe

    spices: [],

    steps: [
      { num: 1, title: 'Rajma Base Banayein', detail: 'Puri Rajma recipe follow karein (upar dekha) — same process.' },
      { num: 2, title: 'Serving Ke Waqt Fresh Tadka ★', detail: 'Serving ke time: alag chhoti pan mein ghee (8g) smoking point tak garam karein → jeera (1g) phatne dein → 2-3 crush lahsun kaliyan golden tak → ek chutki lal mirch powder → TURANT serving bowl mein rajma ke upar daal dein. Sizzle ki awaaz aayegi — customer ke saamne karo toh aur zyada impression padta hai!' },
      { num: 3, title: 'Garnish', detail: 'Fresh hara dhaniya + adrak julienne. Lemon wedge.' },
    ],

    serving: 'Ghee tadka ka visual impact hona chahiye — golden ghee + jeera + red mirch top par dikhne chahiye serving mein.',

    tips: [
      '★ Fresh tadka SERVING KE WAQT hi daalein — advance mein nahi banaein.',
      'Yeh dish ek "wow moment" create karta hai — sizzle sound customer ko pasand aata hai.',
    ],
  },

  // ═══════════════════════════════════════════════════════
  //  CHAWAL (RICE)
  // ═══════════════════════════════════════════════════════

  {
    id: 'steamed-rice',
    name: 'Steamed Rice (Sadha Chawal)',
    emoji: '🍚',
    category: 'Chawal (Rice)',
    usedIn: ['All Rice Combo dishes', 'Extra Rice'],
    prepTime: '20 min (bhigoana)',
    cookTime: '20 minute',
    batchYield: '100g raw = 200-220g cooked (2 portions)',
    description: 'Perfect fluffy steamed rice. Individual grains alag-alag, na undercooked na mushy. FoodFi standard: Sona Masoori rice — basmati se cheaper aur equally good for combos.',

    ingredients: [
      { name: 'Sona Masoori rice (ya Basmati)', qty: '100g', note: 'Wash karein' },
      { name: 'Pani',                           qty: '200ml', note: '2:1 ratio (pani:chawal)' },
      { name: 'Namak',                          qty: '2g',   note: '' },
      { name: 'Tel (optional)',                 qty: '3ml',  note: 'Rice ko alag rakhta hai' },
    ],

    spices: [],

    steps: [
      { num: 1, title: 'Dhoana', detail: 'Rice ko 2-3 baar fresh pani se dhoein jab tak pani clear aaye. Yeh starch remove karta hai aur rice fluffy banata hai.' },
      { num: 2, title: 'Bhigoana (Optional par Recommended)', detail: '20-30 min pani mein bhigoain. Isse rice faster pakta hai aur individual grains better banate hain.' },
      { num: 3, title: 'Cooking — Absorption Method (Best)', detail: 'Patila mein pani + namak + tel garam karein. Rice dalein. HIGH flame par boil aane dein. Phir DHIMI FLAME kar dein. Dhakkan band karein — bilkul pakne dein (10-12 min). Pani sukh jaaye toh rice ready hai.' },
      { num: 4, title: 'Dum (Resting)', detail: 'Aanch band karein. Dhakkan BAND rakhein — 5 minute rest dein. Yeh step bahut important hai: steam se rice properly set hota hai.' },
      { num: 5, title: 'Fluff karna', detail: 'Fork ya ladle se gently fluff karein. Grains alag-alag hone chahiye.' },
    ],

    serving: 'Ek portion = 150g cooked rice (approx 70-75g raw). Serving bowl mein rice neeche dal ke upar sabzi daalein. Presentation: rice ko bowl mein press karke mold banana aur phir sabzi ke bowl mein upaarne se beautiful presentation milta hai.',

    tips: [
      '★ Rice KABHI ZYADA MAT PAKAO — mushy rice customer experience kharab karta hai.',
      'Sona Masoori rice Patna mein sabse common aur affordable hai — bulk mein kharido.',
      'Batch cooking: 2-3kg ek saath pakao. Room temp par 2-3 ghante fresh rahta hai.',
      'Electric rice cooker use karo large batches ke liye — consistent results aate hain.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'jeera-rice',
    name: 'Jeera Rice',
    emoji: '🍚✨',
    category: 'Chawal (Rice)',
    usedIn: ['Jeera Rice with Chole'],
    prepTime: '20 min',
    cookTime: '20 minute',
    batchYield: '100g raw = 200g cooked (2 portions)',
    description: 'Ghee mein crackled jeera + whole spices ke saath bana aromatic rice. Regular rice se upgrade — alag flavor aur aroma. Chole ke saath ek alag level ka combination banata hai.',

    ingredients: [
      { name: 'Basmati rice (long grain)', qty: '100g', note: 'Jeera rice ke liye basmati best hai' },
      { name: 'Ghee (desi)',               qty: '8g',   note: '' },
      { name: 'Pani',                      qty: '200ml', note: '' },
      { name: 'Namak',                     qty: '2g',   note: '' },
    ],

    spices: [
      { name: 'Jeera (cumin sabut)',  qty: '3g',    note: '' },
      { name: 'Tej patta',            qty: '1 leaf', note: '' },
      { name: 'Laung',                qty: '2 pieces', note: '' },
      { name: 'Badi elaichi',         qty: '1 piece', note: '' },
    ],

    steps: [
      { num: 1, title: 'Rice Prep', detail: 'Basmati rice wash + 20 min bhigo.' },
      { num: 2, title: 'Ghee Garam + Jeera', detail: 'Heavy bottom pan/kadai mein ghee garam karein. Jeera dalein — sizzle hone dein (30 sec). Tej patta + laung + elaichi dalein.' },
      { num: 3, title: 'Rice Fry', detail: 'Bhiga rice dalein (paani chhanka ke). 2 minute dhimi aanch par ghee mein coat karein — grains translucent hone lagte hain.' },
      { num: 4, title: 'Pani + Namak', detail: 'Garam pani + namak dalein. HIGH aanch par boil ane dein. DHIMI FLAME — dhakkan band — 12-15 min.' },
      { num: 5, title: 'Dum', detail: '5 minute rest. Gently fluff karein.' },
    ],

    serving: 'Whole spices rice mein dikh sakte hain — customer ko batao ki yeh decorative hain. Aromatic steam serving ke waqt aana chahiye.',

    tips: ['Ghee ki sugandh (aroma) whole spices ke saath bahut important hai — yahi Jeera Rice ki USP hai.'],
  },

  // ═══════════════════════════════════════════════════════
  //  ROTI & PURI
  // ═══════════════════════════════════════════════════════

  {
    id: 'roti',
    name: 'Whole Wheat Roti',
    emoji: '🫓',
    category: 'Roti & Puri',
    usedIn: ['All Roti Combos', 'Extra Roti'],
    prepTime: '20 min (dough rest)',
    cookTime: '2 min per roti',
    batchYield: '100g atta = 4-5 rotis (1 serving)',
    description: 'Soft, fluffy whole wheat roti. Freshly bani, ghee lagi. FoodFi standard: roti GARAM bhejo — thandi roti customer experience kharab karta hai. 5 rotis ek portion.',

    ingredients: [
      { name: 'Gehun ka atta (whole wheat)', qty: '100g', note: 'Good quality chakki atta use karo' },
      { name: 'Pani (gunguna/lukewarm)',      qty: '55-60ml', note: 'Thanda pani se dough stiff hota hai' },
      { name: 'Namak',                        qty: '1g',   note: '' },
      { name: 'Tel ya ghee (dough mein)',     qty: '5ml',  note: 'Soft roti ke liye important' },
      { name: 'Ghee (finishing ke liye)',     qty: '3g/roti', note: 'Har hot roti par ghee lagao' },
    ],

    spices: [],

    steps: [
      { num: 1, title: 'Atta Goondna', detail: 'Atta mein namak + tel mix karein. Phir thoda thoda gunguna pani milate jaao aur goondain. CONSISTENCY: Na zyada sakht, na zyada naram — finger se press karne par thoda indent rahe aur wapas aaye. Yeh soft roti ka base hai.' },
      { num: 2, title: 'Rest Dena ★', detail: 'Dough ko geela kapda ya cling wrap se dhankein — 15-20 minute rest dein. Is step se gluten develop hota hai aur roti SOFT banti hai. Nahi sone denge toh roti hard hogi.' },
      { num: 3, title: 'Balls Banana', detail: 'Equal size ki balls banao — approx 20-22g each. Haath mein ragadkar smooth ball banao.' },
      { num: 4, title: 'Belan Karna', detail: 'Thodi si dry atta lagao. Belan se even thickness mein belai karein — 2-3mm. Round ya slight oval — matter nahi karta. Equal thickness ZAROORI hai warna parts alag pakenge.' },
      { num: 5, title: 'Tawa Garam Karna', detail: 'Tawa ACHHI TARAH GARAM hona chahiye — bade flame par. Test: ek boond pani dalein — instantly evaporate hona chahiye.' },
      { num: 6, title: 'Pehli Side', detail: 'Roti tawa par daalein. 30-40 seconds — jab tak bubbles aane lagein aur edges pakne lagein.' },
      { num: 7, title: 'Dusri Side', detail: 'Palto. 30-40 seconds — brown spots (tikki) aaeni chahiye. Yeh roti ka pakna confirm karta hai.' },
      { num: 8, title: 'Phulana', detail: 'Direct gas flame par chimta se hold karein ya tawa ki ulti side par rakhein — roti PHUL JAAYEGI. Patna mein fully phuli roti ka standard maintain karo.' },
      { num: 9, title: 'Ghee Lagana ★', detail: 'HOT roti par fauran ghee lagao — melts on contact. Isse roti soft rehti hai, shine aata hai, aur taste bahut improve hota hai.' },
    ],

    serving: '5 rotis per portion. Foil ya insulated container mein pack karein taaki garam rahein. Delivery mein bhi garam pahunchni chahiye.',

    tips: [
      '★ Dough rest ZAROOR karein — yeh step skip karne se roti hard hoti hai.',
      '★ Hot tawa par hi daalein — thande tawa par roti stick karti hai aur sahi nahi phulti.',
      '★ Ghee laganaa ZAROOR hai — yeh FoodFi ki quality standard hai.',
      'Bulk: 1kg atta se 45-50 rotis banti hain. 2 ghante pehle dough bana lo — rest milti hai.',
      'Quality check: Roti soft honi chahiye — tawa ke thande hone par khud se toot jaaye, hard nahi.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'puri',
    name: 'Puri (Crispy Phuli Hui)',
    emoji: '🫓🔵',
    category: 'Roti & Puri',
    usedIn: ['All Puri Combos', 'Extra Puri'],
    prepTime: '15 min',
    cookTime: '1 min per puri',
    batchYield: '100g atta/maida = 6-7 puris (1 serving)',
    description: 'Crispy bahar se, hollow andar se. Traditional Indian deep-fried bread. 6 puris ek portion. Puri ka phulna AUR crispy rehna dono zaroori hai — Patna mein yeh quality se samjhauth nahi.',

    ingredients: [
      { name: 'Maida ya Atta ya 50-50 mix', qty: '100g', note: '50-50 mix best hai — crispy yet not too heavy' },
      { name: 'Tel (dough mein)',            qty: '10ml', note: 'Short-crust effect ke liye — crispy puri' },
      { name: 'Namak',                       qty: '1g',   note: '' },
      { name: 'Pani',                        qty: '45-50ml', note: 'Roti se STIFFER dough chahiye' },
      { name: 'Tel (frying ke liye)',        qty: '500ml', note: 'Kadai mein, pure frying ke liye' },
    ],

    spices: [],

    steps: [
      { num: 1, title: 'Dough Banana ★', detail: 'PEHLE tel ko atta/maida mein haath se ragadkar mix karein (moyen karna). Phir pani dalein. STIFF DOUGH — roti se sakhta. Tight dough se puri phulti hai aur crispy hoti hai. Naram dough se oil soak karta hai aur soft-greasy puri banti hai.' },
      { num: 2, title: 'Rest', detail: '10-15 min rest. Roti se kam time — puri mein zyada rest ki zaroorat nahi.' },
      { num: 3, title: 'Puri Belna', detail: 'Chhote balls (15-18g each). THIN belna — 1-2mm. Very thin = hollow inside + crispy outside. Bahut thick belne par puri oily aur kachchi rehti hai.' },
      { num: 4, title: 'Oil Temperature ★', detail: 'Tel MEDIUM-HIGH garam karein: 170-180°C. Test: ek chhoti ball daalein — TURANT upar aa jaaye aur sizzle kare. Thanda tel mein puri oil absorb karti hai. Bahut garam tel mein puri kaali ho jaati hai bina phule.' },
      { num: 5, title: 'Talna ★', detail: 'Puri tel mein daalein. Fauran spatula se GENTLY PRESS karein — puri phulne lagegi. Ek side 20-30 seconds. PALTO — dusri side 15-20 seconds. Light golden color chahiye — dark brown nahi.' },
      { num: 6, title: 'Drain', detail: 'Paper towel ya jali par drain karein. Oil nikaalna zaroori hai.' },
    ],

    serving: '6 puris per portion. Crispy aur hot serve karein — thandi puri ka crunch khatam ho jaata hai. Puri ke saath chole/rajma gravy thodi thick rakhein.',

    tips: [
      '★ DOUGH STIFF RAKHEIN — naram dough = oily + flat puri.',
      '★ Tel ka temperature MAINTAIN karein — thermometer use karo ya regular testing karo.',
      '★ Thin belna — yahi phuli crispy puri ka secret.',
      'Puri immediately serve karein — 15 min baad softness aane lagti hai.',
      'Tel ko strain karein after each batch — kala hua tel kharab lagta hai.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'butter-roti',
    name: 'Butter Roti',
    emoji: '🫓🧈',
    category: 'Roti & Puri',
    usedIn: ['Butter Roti (Add-On)'],
    prepTime: '2 min',
    cookTime: '2 min',
    batchYield: '1 roti',
    description: 'Fresh hot roti with extra butter (makhan) applied on both sides while still on tawa. Simple upgrade from regular roti.',

    ingredients: [
      { name: 'Ek fresh roti (ready)',   qty: '1 piece', note: 'Roti recipe se banayein' },
      { name: 'Amul butter ya desi ghee', qty: '5-7g',   note: 'Generous amount — this is "butter" roti' },
    ],

    spices: [],

    steps: [
      { num: 1, title: 'Regular Roti Banayein', detail: 'Standard roti process follow karein.' },
      { num: 2, title: 'Butter Apply Karna', detail: 'Roti hot hone par FAURAN generous amount butter ya ghee dono sides par lagao. Butter pighalta hua dikhna chahiye — yeh visual bahut appetizing lagta hai.' },
    ],

    serving: 'Hot serve karein. Melted butter glistening dikhna chahiye — customer dekhte hi impress ho.',

    tips: ['Butter fresh aur cold rakhein — spread karne par hi melt hoga. Pehle se pighala mat rakhein.'],
  },

  // ═══════════════════════════════════════════════════════
  //  ADD-ONS
  // ═══════════════════════════════════════════════════════

  {
    id: 'raita',
    name: 'Raita (Kheera-Dahi)',
    emoji: '🥛',
    category: 'Add-Ons',
    usedIn: ['Raita (side dish)'],
    prepTime: '5 min',
    cookTime: 'No cooking',
    batchYield: '100g dahi = 2 portions (50g each)',
    description: 'Chilled fresh yogurt with cucumber. Simple par essential side dish. Kisi bhi rich sabzi ke saath coolant ki tarah kaam karta hai. FoodFi standard: THICK dahi use karo, paatla nahi.',

    ingredients: [
      { name: 'Dahi (thick, fresh)',           qty: '100g', note: 'Sour nahi hona chahiye' },
      { name: 'Kheera (cucumber, grated/kata)', qty: '40g',  note: 'Extra pani squeeze karke nikalo' },
      { name: 'Hara dhaniya (chopped)',         qty: '5g',   note: '' },
      { name: 'Pudina (mint, chopped)',         qty: '3g',   note: '' },
    ],

    spices: [
      { name: 'Bhuna jeera powder',  qty: '2g',    note: '' },
      { name: 'Kala namak',          qty: '1g',    note: 'Alag flavor aata hai' },
      { name: 'Saada namak',         qty: '1g',    note: '' },
      { name: 'Kali mirch',          qty: '0.5g',  note: '' },
      { name: 'Lal mirch (opt)',      qty: '0.5g',  note: '' },
    ],

    steps: [
      { num: 1, title: 'Dahi Phentna', detail: 'Dahi ko fork ya whisk se smooth karein — lumpy nahi rehna chahiye.' },
      { num: 2, title: 'Kheera Prep ★', detail: 'Kheera grate karein ya barik kaatein. SQUEEZE KAREIN haath se — extra pani nikalo. Warna raita paatla ho jaayega.' },
      { num: 3, title: 'Mix Karna', detail: 'Dahi mein kheera + dhaniya + pudina milao. Masale dalein. Mix karein.' },
      { num: 4, title: 'Chill Karna ★', detail: 'REFRIGERATE karein serving se pehle. THANDA RAITA hi serve karo — garam ya room temp raita acha nahi lagta.' },
    ],

    serving: 'Ek portion = 50g. Chhoti side bowl mein serve karein. Garnish: ek chutki bhuna jeera + pudina leaf.',

    tips: [
      '★ Dahi fresh hona chahiye — sour dahi se raita kharab taste aata hai.',
      '★ Thanda serve karein — cold raita hot sabzi ke saath perfect contrast create karta hai.',
      'Kheera ka extra pani squeeze karna zaroori hai warna raita thin ho jaata hai.',
    ],
  },

  // ───────────────────────────────────────────────────────

  {
    id: 'green-chutney',
    name: 'Green Chutney (Pudina-Dhaniya)',
    emoji: '💚',
    category: 'Add-Ons',
    usedIn: ['Chutney (side), Extra Chutney'],
    prepTime: '5 min',
    cookTime: 'No cooking',
    batchYield: '100g fresh leaves = 6-8 portions',
    description: 'Fresh mint-coriander green chutney. Tangy, spicy, fresh. Har dish ke saath serve karo — yeh FoodFi ka signature condiment hai. Daily fresh banana best practice hai.',

    ingredients: [
      { name: 'Hara dhaniya (coriander)',  qty: '60g',   note: 'Stems bhi use karo — waste mat karo' },
      { name: 'Pudina (fresh mint)',        qty: '40g',   note: '' },
      { name: 'Hari mirch',               qty: '3 pieces', note: 'Adjust spice level' },
      { name: 'Lahsun (kali)',             qty: '2-3 kali', note: '' },
      { name: 'Adrak',                    qty: '5g',    note: '' },
      { name: 'Nimbu ras (lemon juice)',   qty: '15ml',  note: 'Ek nimbu ka ras — FRESH' },
      { name: 'Pani',                     qty: '20ml',  note: 'Blend karne ke liye — minimum use karo' },
    ],

    spices: [
      { name: 'Jeera (bhuna hua)',  qty: '1g',   note: '' },
      { name: 'Kala namak',         qty: '2g',   note: '' },
      { name: 'Saada namak',        qty: '2g',   note: '' },
      { name: 'Chini',              qty: '2g',   note: 'Balance ke liye thodi' },
    ],

    steps: [
      { num: 1, title: 'Sab Kuch Mixi Mein', detail: 'Dhaniya + pudina + hari mirch + lahsun + adrak + pani (minimum) mixi mein daalein.' },
      { num: 2, title: 'Blend', detail: 'THICK PASTE banaein — paatla nahi karna. Thoda pani daalein sirf blend hone ke liye.' },
      { num: 3, title: 'Seasoning', detail: 'Nimbu ras + kala namak + saada namak + chini + jeera dalein. Taste check karein — tangy + spicy + fresh balance hona chahiye.' },
      { num: 4, title: 'Refrigerate', detail: 'Air-tight container mein store karein. 3-4 din fresh rahti hai.' },
    ],

    serving: 'Ek portion = 20-25g chhoti side bowl mein. BRIGHT GREEN color hona chahiye — dark color matlab stale hai.',

    tips: [
      '★ DAILY FRESH BANANA BEST HAI — 3 din se purani chutney color kho deti hai.',
      'Nimbu ras FRESH SQUEEZE KARO — bottled lemon juice se taste alag hota hai.',
      'Thick consistency rakhein — paatli chutney bowl se bahar nikal jaati hai delivery mein.',
      'Hari mirch ki matra adjust karo season ke hisab se — garmi mein thodi kam, sardi mein zyada.',
    ],
  },

]

// ═══════════════════════════════════════════════════════════════════
//  COMBO GUIDE — Kaunse Base Recipes Milate Hain
// ═══════════════════════════════════════════════════════════════════

export const COMBO_GUIDE = [
  { item: 'Rajma Rice Bowl',         base: ['Rajma', 'Steamed Rice (Sadha Chawal)'],              note: 'Rice bowl neeche, rajma upar. Ghee + dhaniya garnish.' },
  { item: 'Classic Chole Rice',      base: ['Chole / Masala Chole', 'Steamed Rice'],              note: 'Lemon wedge zaroori.' },
  { item: 'Matar Chola Rice',        base: ['Matar Chole', 'Steamed Rice'],                       note: 'Matar green color dikhna chahiye.' },
  { item: 'Paneer Chola Rice',       base: ['Paneer Tadka / Paneer Chola', 'Steamed Rice'],       note: 'Premium presentation.' },
  { item: 'Mix Protein Rice Bowl',   base: ['Mix Chole', 'Steamed Rice'],                         note: 'Teen dalon ka color attractive.' },
  { item: 'White Chana Rice Bowl',   base: ['White Chana', 'Steamed Rice'],                       note: 'Golden-yellow combo.' },
  { item: 'Dal Tadka Rice',          base: ['Dal Tadka', 'Steamed Rice'],                         note: 'Dal paatli rakhein rice ke saath.' },
  { item: 'Jeera Rice with Chole',   base: ['Chole / Masala Chole', 'Jeera Rice'],                note: 'Aromatic jeera rice + dark chole = premium.' },
  { item: '5 Roti with Rajma',       base: ['Rajma', 'Whole Wheat Roti (x5)'],                   note: '5 ghee-lagi hot rotis + rajma bowl.' },
  { item: '5 Roti with Chole',       base: ['Chole / Masala Chole', 'Whole Wheat Roti (x5)'],    note: '' },
  { item: '5 Roti with Dal Tadka',   base: ['Dal Tadka', 'Whole Wheat Roti (x5)'],               note: 'Dal thodi thick rakhein roti ke saath.' },
  { item: '5 Roti with Mix Chole',   base: ['Mix Chole', 'Whole Wheat Roti (x5)'],               note: '' },
  { item: '5 Roti with Paneer Chola',base: ['Paneer Tadka / Paneer Chola', 'Whole Wheat Roti (x5)'], note: 'Premium roti combo.' },
  { item: '5 Roti with Tadka Chana', base: ['Chana Tadka', 'Whole Wheat Roti (x5)'],             note: '' },
  { item: '6 Roti with Dal Fry',     base: ['Dal Fry', 'Whole Wheat Roti (x6)'],                 note: '6 rotis is combo mein.' },
  { item: '6 Puri with Rajma',       base: ['Rajma', 'Puri (x6)'],                               note: '6 crispy puris + rajma bowl.' },
  { item: '6 Puri with Chole',       base: ['Chole / Masala Chole', 'Puri (x6)'],                note: 'Breakfast combo — popular.' },
  { item: '6 Puri with Mix Chole',   base: ['Mix Chole', 'Puri (x6)'],                           note: '' },
  { item: 'Chana Tadka',             base: ['Chana Tadka'],                                      note: 'Tadka dish alag bowl mein.' },
  { item: 'Rajma Tadka',             base: ['Rajma Tadka'],                                      note: 'Fresh ghee tadka on top.' },
  { item: 'Mix Chole Tadka',         base: ['Mix Chole'],                                        note: '' },
  { item: 'White Chana Tadka',       base: ['White Chana'],                                      note: '' },
  { item: 'Dal Tadka',               base: ['Dal Tadka'],                                        note: '' },
  { item: 'Dal Fry',                 base: ['Dal Fry'],                                          note: '' },
  { item: 'Paneer Tadka',            base: ['Paneer Tadka / Paneer Chola'],                      note: '' },
  { item: 'Masala Chole',            base: ['Chole / Masala Chole'],                             note: 'Thoda extra thick, anardana garnish.' },
  { item: 'Raita',                   base: ['Raita (Kheera-Dahi)'],                              note: '' },
  { item: 'Green Chutney',           base: ['Green Chutney'],                                    note: '' },
  { item: 'Butter Roti',             base: ['Butter Roti'],                                      note: 'Generous butter.' },
]

// ═══════════════════════════════════════════════════════════════════
//  KITCHEN STANDARDS & QUALITY CHECKLIST
// ═══════════════════════════════════════════════════════════════════

export const KITCHEN_STANDARDS = [
  { category: 'Hygiene', points: [
    'Haath dhoana — har cheez handle karne se pehle',
    'Sabziyon ko serve karne se pehle taste zaroor karo',
    'Cutting boards alag — raw ingredients vs cooked',
    'Refrigerator temperature: 4°C se kam',
    'Hot food: 60°C se upar serve karein',
  ]},
  { category: 'Ingredient Freshness', points: [
    'Paneer: DAILY fresh lena — 2 din se purana kabhi nahi',
    'Dahi: Sour nahi hona chahiye — daily check',
    'Dhaniya-pudina: Daily fresh — wilted nahi use karna',
    'Lemon: Fresh squeeze karo — bottled nahi',
    'Masale: Air-tight containers mein — nami se bachao',
  ]},
  { category: 'Portion Standards', points: [
    'Rajma/Chole/Dal: 150-170g per serving',
    'Rice: 150g cooked per serving',
    'Roti: 5 pieces (ek combo mein) — sab equal size',
    'Puri: 6 pieces — sab crispy',
    'Raita: 50g per serving',
    'Chutney: 20-25g per serving',
  ]},
  { category: 'Presentation', points: [
    'Hot food hot serve karein — minimum 60°C',
    'Garnish: Hara dhaniya + adrak julienne EVERY order mein',
    'Gravy spill nahi hona chahiye — container proper seal',
    'Rice bowl: Rice neeche, curry upar — do not mix',
    'Roti: Foil wrap karein heat retention ke liye',
  ]},
]

// ═══════════════════════════════════════════════════════════════════
//  PDF GENERATOR FUNCTION
// ═══════════════════════════════════════════════════════════════════

export function printRecipeBook(selectedCategory = 'Sab Recipes') {
  const filteredRecipes = selectedCategory === 'Sab Recipes'
    ? RECIPES
    : RECIPES.filter(r => r.category === selectedCategory)

  const recipeHTML = filteredRecipes.map(recipe => `
    <div class="recipe-page">
      <div class="recipe-header">
        <span class="recipe-emoji">${recipe.emoji}</span>
        <div>
          <h2 class="recipe-name">${recipe.name}</h2>
          <span class="recipe-cat">${recipe.category}</span>
        </div>
      </div>
      <p class="recipe-desc">${recipe.description}</p>
      <div class="meta-row">
        <span>⏱ Prep: <b>${recipe.prepTime}</b></span>
        <span>🔥 Cook: <b>${recipe.cookTime}</b></span>
        <span>🍽 Yield: <b>${recipe.batchYield}</b></span>
      </div>
      ${recipe.usedIn?.length ? `<div class="used-in">📋 Used in: ${recipe.usedIn.join(' · ')}</div>` : ''}

      ${recipe.ingredients?.length ? `
        <h3>🛒 Samagri (per 100g main ingredient)</h3>
        <table>
          <thead><tr><th>Ingredient</th><th>Matra</th><th>Note</th></tr></thead>
          <tbody>
            ${recipe.ingredients.map(i => `<tr><td>${i.name}</td><td><b>${i.qty}</b></td><td>${i.note || '—'}</td></tr>`).join('')}
          </tbody>
        </table>
      ` : ''}

      ${recipe.spices?.length ? `
        <h3>🌶 Masale</h3>
        <table>
          <thead><tr><th>Masala</th><th>Matra</th><th>Note</th></tr></thead>
          <tbody>
            ${recipe.spices.map(s => `<tr><td>${s.name}</td><td><b>${s.qty}</b></td><td>${s.note || '—'}</td></tr>`).join('')}
          </tbody>
        </table>
      ` : ''}

      ${recipe.steps?.length ? `
        <h3>👨‍🍳 Banane Ki Vidhi</h3>
        ${recipe.steps.map(step => `
          <div class="step">
            <span class="step-num">${step.num}</span>
            <div>
              <b>${step.title}</b>
              <p>${step.detail}</p>
            </div>
          </div>
        `).join('')}
      ` : ''}

      ${recipe.serving ? `
        <div class="serving-box">
          <b>🍽 Serving Style:</b> ${recipe.serving}
        </div>
      ` : ''}

      ${recipe.tips?.length ? `
        <div class="tips-box">
          <b>💡 Chef Tips:</b>
          <ul>${recipe.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>
      ` : ''}
    </div>
  `).join('')

  const comboHTML = `
    <div class="recipe-page">
      <h2>🍱 Combo Guide — Kaunse Items Se Kya Banta Hai</h2>
      <table>
        <thead><tr><th>Menu Item</th><th>Base Recipes</th><th>Special Note</th></tr></thead>
        <tbody>
          ${COMBO_GUIDE.map(c => `<tr><td><b>${c.item}</b></td><td>${c.base.join(' + ')}</td><td>${c.note || '—'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `

  const standardsHTML = `
    <div class="recipe-page">
      <h2>✅ FoodFi Kitchen Standards & Quality Checklist</h2>
      ${KITCHEN_STANDARDS.map(s => `
        <h3>${s.category}</h3>
        <ul>${s.points.map(p => `<li>${p}</li>`).join('')}</ul>
      `).join('')}
    </div>
  `

  const printWindow = window.open('', '_blank')
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="UTF-8">
      <title>FoodFi Cloud Kitchen — Recipe Book</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; padding: 0; }

        .cover { text-align: center; padding: 80px 40px; background: linear-gradient(135deg, #fff7ed, #fef3c7); min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: always; }
        .cover-logo { font-size: 60px; margin-bottom: 16px; }
        .cover h1 { font-size: 36px; color: #e85d04; margin-bottom: 8px; }
        .cover .subtitle { font-size: 18px; color: #6b7280; margin-bottom: 4px; }
        .cover .meta { font-size: 13px; color: #9ca3af; margin-top: 20px; }
        .cover .tagline { font-size: 14px; color: #374151; margin-top: 12px; font-style: italic; }

        .recipe-page { padding: 24px 32px; page-break-after: always; border-bottom: 2px solid #f97316; }
        .recipe-header { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
        .recipe-emoji { font-size: 40px; }
        .recipe-name { font-size: 22px; font-weight: 700; color: #e85d04; }
        .recipe-cat { font-size: 11px; background: #fff7ed; color: #e85d04; border-radius: 4px; padding: 2px 8px; }
        .recipe-desc { color: #374151; font-size: 12px; margin-bottom: 12px; line-height: 1.6; }

        .meta-row { display: flex; gap: 24px; margin: 8px 0 12px; font-size: 11px; color: #6b7280; }
        .used-in { font-size: 11px; color: #6b7280; margin-bottom: 12px; background: #f9fafb; padding: 6px 10px; border-radius: 4px; }

        h3 { font-size: 13px; color: #1f2937; margin: 14px 0 8px; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
        th { background: #fff7ed; color: #e85d04; text-align: left; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; }
        tr:nth-child(even) td { background: #fafafa; }

        .step { display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-start; }
        .step-num { min-width: 24px; height: 24px; background: #e85d04; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .step p { color: #374151; font-size: 11px; margin-top: 2px; line-height: 1.6; }

        .serving-box { background: #f0fdf4; border-left: 3px solid #22c55e; padding: 10px 14px; margin: 14px 0; font-size: 11px; line-height: 1.6; }
        .tips-box { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 14px; margin: 14px 0; font-size: 11px; }
        .tips-box ul { padding-left: 16px; margin-top: 6px; }
        .tips-box li { margin-bottom: 4px; line-height: 1.5; }

        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .recipe-page { page-break-after: always; }
          .cover { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="cover">
        <div class="cover-logo">🍽️</div>
        <h1>FoodFi Cloud Kitchen</h1>
        <div class="subtitle">Master Recipe Book</div>
        <div class="subtitle">Chef: Saif — Patna, Bihar</div>
        <div class="tagline">"Ghar ka swaad, cloud kitchen ki quality"</div>
        <div class="meta">
          Total Recipes: ${filteredRecipes.length} |
          Patna/Bihar North Indian Style |
          All quantities per 100g main ingredient
        </div>
        <div class="meta">Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      ${recipeHTML}
      ${comboHTML}
      ${standardsHTML}
    </body>
    </html>
  `)
  printWindow.document.close()
  setTimeout(() => printWindow.print(), 800)
}
