// ============================================================================
// LEGAL METROLOGY AI ENFORCEMENT ENGINE (SIH #26034)
// DUAL-ORIGIN NETWORK ENGINE, 12-LANGUAGE DICTIONARY & CONVERSATIONAL AI
// Migrated from FRONTEND/script.js; camera and canvas controllers retain their existing behavior.
// ============================================================================

export function initializeScanner(configuredApiUrl = "") {
  const lifetime = new AbortController();
  const disposers = [];
  const timers = new Set();
  const frames = new Set();
  const intervals = new Set();
  const photoObjectUrls = new Map();
  function listen(target, event, handler, options = {}) {
    target.addEventListener(event, handler, { ...(typeof options === 'boolean' ? {capture:options} : options), signal:lifetime.signal });
  }
  function later(fn, delay) { const id = setTimeout(() => { timers.delete(id); if (!lifetime.signal.aborted) fn(); }, delay); timers.add(id); return id; }
  function repeat(fn, delay) { const id = setInterval(fn, delay); intervals.add(id); return id; }
  function frame(fn) { const id = requestAnimationFrame(() => { frames.delete(id); if (!lifetime.signal.aborted) fn(); }); frames.add(id); return id; }
  function request(url, options = {}) {
    return fetch(url, {...options, signal: options.signal ? AbortSignal.any([options.signal, lifetime.signal]) : lifetime.signal});
  }
  function dispose() {
    lifetime.abort();
    timers.forEach(clearTimeout); intervals.forEach(clearInterval); frames.forEach(cancelAnimationFrame);
    if (videoStream) videoStream.getTracks().forEach(track => track.stop());
    photoObjectUrls.forEach(url => URL.revokeObjectURL(url));
    disposers.forEach(fn => fn());
  }

  // -------------------------------------------------------------
  // 1. ACTIVE MULTI-ORIGIN PROBING ENGINE (Solves Localhost & Offline Errors)
  // -------------------------------------------------------------
  let API_BASE = configuredApiUrl || (
    window.location.port === "8000" || window.location.protocol === "https:"
      ? window.location.origin
      : "http://" + (window.location.hostname || "127.0.0.1") + ":8000"
  );
  document.querySelectorAll('a[href^="http://127.0.0.1:8000"]').forEach(link => {
    link.href = API_BASE + new URL(link.href).pathname;
  });

  const hostedPreview = window.location.protocol === "https:" && !configuredApiUrl;
  if (hostedPreview) {
    const notice = document.createElement("div");
    notice.textContent = "Website preview — the OCR backend is not connected yet. Scanning is unavailable on this link.";
    notice.style.cssText = "background:#fff3cd;color:#664d03;padding:16px;text-align:center;font-weight:600;position:relative;z-index:10000";
    document.body.prepend(notice);
    disposers.push(() => notice.remove());
  }

  async function resolveActiveBackend() {
    const port = "8000";
    const host = window.location.hostname || "127.0.0.1";
    const probeTargets = configuredApiUrl ? [configuredApiUrl] : [
      window.location.origin,
      "http://" + host + ":" + port,
      "http://127.0.0.1:" + port,
      "http://localhost:" + port
    ];

    if (hostedPreview) {
      updateStatusBar("Website preview: hosted scanning is not connected yet.");
      return false;
    }
    for (let i = 0; i < probeTargets.length; i++) {
      const url = probeTargets[i];
      try {
        const controller = new AbortController();
        const timer = later(() => controller.abort(), configuredApiUrl ? 90000 : 5000);
        let res, health;
        try {
          res = await request(url + "/api/health", { method: "GET", signal: controller.signal });
          health = await res.json();
        } finally { clearTimeout(timer); timers.delete(timer); }
        // Render's loading page can return HTTP 200 before the API is ready.
        if (res.ok && health.status === "ONLINE" && health.ocr_engine) {
          API_BASE = url;
          return true;
        }
      } catch (err) { if (lifetime.signal.aborted) return false; }
    }
    return false;
  }

  function updateStatusBar(msg) {
    const el = document.getElementById("statusBar");
    if (el) el.textContent = msg;
  }

  // -------------------------------------------------------------
  // 2. ADMINISTRATIVE GEOGRAPHY (28 States & 8 UTs)
  // -------------------------------------------------------------
  const indiaGeography = {
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Kurnool", "Nellore", "Anantapur", "Kakinada", "Rajahmundry", "Kadapa"],
    "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro", "Bomdila"],
    "Assam": ["Guwahati", "Dibrugarh", "Silchar", "Jorhat", "Nagaon", "Tinsukia", "Tezpur"],
    "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif", "Arrah"],
    "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon", "Jagdalpur"],
    "Goa": ["North Goa", "South Goa", "Panaji", "Margao", "Vasco da Gama", "Mapusa"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Anand"],
    "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Panchkula"],
    "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi", "Solan", "Kullu", "Hamirpur", "Bilaspur"],
    "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh"],
    "Karnataka": ["Bengaluru Urban", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", "Kalaburagi", "Davanagere", "Ballari", "Shivamogga"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Palakkad", "Alappuzha", "Kannur", "Kottayam"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Amravati", "Kolhapur", "Navi Mumbai"],
    "Manipur": ["Imphal East", "Imphal West", "Bishnupur", "Thoubal", "Churachandpur"],
    "Meghalaya": ["East Khasi Hills", "West Garo Hills", "Shillong", "Tura", "Jowai"],
    "Mizoram": ["Aizawl", "Lunglei", "Champhai", "Kolasib", "Serchhip"],
    "Nagaland": ["Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore", "Bhadrak"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Hoshiarpur", "Pathankot"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Sikar"],
    "Sikkim": ["Gangtok", "Namchi", "Gyalshing", "Mangan"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Tiruppur", "Vellore", "Erode", "Thoothukudi"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam", "Secunderabad"],
    "Tripura": ["West Tripura", "Agartala", "Dharmanagar", "Udaipur", "Kailashahar"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Noida", "Ghaziabad", "Meerut", "Bareilly", "Aligarh", "Moradabad", "Gorakhpur"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rishikesh", "Nainital"],
    "West Bengal": ["Kolkata", "Howrah", "Asansol", "Siliguri", "Durgapur", "Bardhaman", "Malda", "Kharagpur"],
    "Delhi": ["New Delhi", "North Delhi", "South Delhi", "West Delhi", "East Delhi", "Central Delhi"],
    "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Kathua", "Udhampur"]
  };

  const stateLangDefaults = {
    "Andhra Pradesh": "te", "Telangana": "te",
    "Tamil Nadu": "ta", "Karnataka": "kn", "Kerala": "ml",
    "Maharashtra": "mr", "Gujarat": "gu", "Punjab": "pa",
    "West Bengal": "bn", "Odisha": "or", "Jammu and Kashmir": "ur",
    "Delhi": "hi", "Uttar Pradesh": "hi", "Bihar": "hi", "Madhya Pradesh": "hi",
    "Rajasthan": "hi", "Haryana": "hi", "Himachal Pradesh": "hi", "Uttarakhand": "hi"
  };

  // -------------------------------------------------------------
  // 3. ALL 12 OFFICIAL INDIAN LANGUAGES DICTIONARY
  // -------------------------------------------------------------
  const i18n = {
    en: {
      agencyTitle: "Department of Consumer Affairs",
      viewRulesBtn: "📖 PCR 2011 Rules",
      lblTotalScanned: "Total Products Scanned",
      lblCompliant: "Compliant Commodities",
      lblViolations: "Violations Detected",
      lblUploadTitle: "Product Evidence Capture",
      lblUploadSub: "Upload packaging photo or capture via live camera.",
      lblDropText: "Add your package photos",
      lblDropHint: "Choose photos or drop them here · JPG, PNG, WEBP",
      lblPdpArea: "Principal Display Panel Area (sq. cm):",
      scanBtn: "Run Legal Metrology Verification",
      lblAuditTitle: "PCR 2011 Compliance Audit",
      verdictPass: "✔ COMPLIANT: All declarations comply with PCR 2011",
      verdictFail: "✖ VIOLATIONS DETECTED: Non-compliant declarations found",
      reportBtnCitizen: "🚨 Report to Local Authorities",
      reportBtnOfficer: "🚨 Issue Statutory Notice",
      rules: {
        mrp: "Rule 6(1)(e): Maximum Retail Price (MRP)",
        net_qty: "Rule 6(1)(c): Net Quantity & Metric Units",
        mfg_date: "Rule 6(1)(d): Month & Year of Packing/Manufacture",
        manufacturer: "Rule 6(1)(a): Manufacturer Identity",
        consumer_care: "Rule 6(1)(n): Consumer Grievance Contact",
        usp: "Rule 6(11): Unit Sale Price (USP)",
        font_compliance: "Rule 7 (Table II): Numeral Height",
        category_statutory: "Statutory Category Verification"
      },
      rulesDescriptions: {
        mrp: "MRP must be declared in Indian Rupees (₹) with the mandatory statutory phrase 'inclusive of all taxes'. Dual pricing or charging higher prices violates Section 36.",
        net_qty: "Weight or measure must be declared strictly in standard SI units (g, kg, ml, l). Use of non-standard symbols like 'gm' or 'ltr' is illegal.",
        mfg_date: "The month and year in which the commodity is manufactured, packed, or imported must be clearly indicated.",
        manufacturer: "The complete registered address of the manufacturer, packer, or importer must be declared on the principal display panel.",
        consumer_care: "Contact details (Telephone, Email) of the grievance redressal cell must be clearly printed for consumer redressal.",
        usp: "Unit Sale Price (₹/g, ₹/ml, ₹/kg, ₹/l) must be printed on retail packages. Exempt if net quantity equals 1 kg/1 L/1 unit.",
        font_compliance: "Numeral and letter sizes must strictly comply with Table II minimum heights based on the surface area of the Principal Display Panel.",
        category_statutory: "Category-specific mandates like FSSAI (Foods/Drinks), M-Lic (Cosmetics), or Country of Origin (Electronics)."
      }
    },
    te: {
      agencyTitle: "వినియోగదారుల వ్యవహారాల శాఖ",
      viewRulesBtn: "📖 PCR 2011 నిబంధనలు",
      lblTotalScanned: "మొత్తం స్కాన్ చేసిన ఉత్పత్తులు",
      lblCompliant: "నిబంధనలకు అనుగుణమైనవి",
      lblViolations: "గుర్తించిన ఉల్లంఘనలు",
      lblUploadTitle: "ఉత్పత్తి సాక్ష్యాల సేకరణ",
      lblUploadSub: "లేబుల్ ఫోటోను అప్‌లోడ్ చేయండి లేదా కెమెరా ద్వారా తీసుకోండి.",
      lblDropText: "ప్యాకేజీ చిత్రాన్ని ఇక్కడ ఉంచండి",
      lblDropHint: "PNG, JPG, WEBP ఫార్మాట్‌లకు మద్దతు ఉంది",
      lblPdpArea: "ప్రదర్శన వైశాల్యం (చ.సెం.మీ):",
      scanBtn: "లీగల్ మెట్రాలజీ తనిఖీ చేయండి",
      lblAuditTitle: "PCR 2011 ఆడిట్ ఫలితాలు",
      verdictPass: "✔ నిబంధనలకు అనుగుణంగా ఉంది (Compliant)",
      verdictFail: "✖ ఉల్లంఘనలు కనుగొనబడ్డాయి (Violations Detected)",
      reportBtnCitizen: "🚨 స్థానిక అధికారులకు ఫిర్యాదు చేయండి",
      reportBtnOfficer: "🚨 చట్టబద్ధమైన నోటీసు ఇవ్వండి",
      rules: {
        mrp: "రూల్ 6(1)(e): గరిష్ట రిటైల్ ధర (MRP)",
        net_qty: "రూల్ 6(1)(c): నికర పరిమాణం & ప్రామాణిక యూనిట్లు",
        mfg_date: "రూల్ 6(1)(d): తయారీ తేదీ / నెల",
        manufacturer: "రూల్ 6(1)(a): తయారీదారు చిరునామా",
        consumer_care: "రూల్ 6(1)(n): కస్టమర్ కేర్ వివరాలు",
        usp: "రూల్ 6(11): యూనిట్ అమ్మకపు ధర (USP)",
        font_compliance: "రూల్ 7 (టేబుల్ II): అక్షరాల పరిమాణం",
        category_statutory: "నిర్దిష్ట చట్టబద్ధ వర్గ ధృవీకరణ"
      },
      rulesDescriptions: {
        mrp: "MRP ఖచ్చితంగా రూపాయిలలో (₹) 'అన్ని పన్నులతో కలిపి' అనే పదంతో ఉండాలి. MRP కంటే ఎక్కువ అమ్మడం చట్టరీత్యా నేరం.",
        net_qty: "పరిమాణం ప్రామాణిక మెట్రిక్ యూనిట్లలో (g, kg, ml, l) మాత్రమే ఉండాలి. 'gm', 'ltr' వంటివి చట్టవిరుద్ధం.",
        mfg_date: "వస్తువు తయారైన లేదా ప్యాక్ చేసిన నెల మరియు సంవత్సరం స్పష్టంగా ముద్రించాలి.",
        manufacturer: "తయారీదారు లేదా ప్యాకర్ పూర్తి పేరు మరియు భౌగోళిక చిరునామా ఉండాలి.",
        consumer_care: "వినియోగదారుల సహాయార్థం హెల్ప్‌లైన్ నంబర్, ఈమెయిల్ మరియు పూర్తి చిరునామా తప్పనిసరి.",
        usp: "వినియోగదారులు ధరలను పోల్చుకోవడానికి ప్రతి గ్రాము/మి.లీ కు ధర (USP) ప్రకటించాలి. 1 కిలో/1 లీటరు ప్యాక్‌లకు మినహాయింపు కలదు.",
        font_compliance: "ప్యాకెట్ వైశాల్యం ఆధారంగా అక్షరాలు టేబుల్ II కనీస ఎత్తు ప్రమాణాలకు అనుగుణంగా ఉండాలి.",
        category_statutory: "ఆహార పదార్థాలకు FSSAI గుర్తు, సౌందర్య సాధనాలకు M-Lic, ఎలక్ట్రానిక్స్ కు తయారీ దేశం తప్పనిసరి."
      }
    },
    hi: {
      agencyTitle: "उपभोक्ता मामले विभाग",
      viewRulesBtn: "📖 पीसीआर 2011 नियम",
      lblTotalScanned: "कुल स्कैन किए गए उत्पाद",
      lblCompliant: "मानक-अनुरूप उत्पाद",
      lblViolations: "उल्लंघन पाए गए",
      lblUploadTitle: "उत्पाद साक्ष्य कैप्चर",
      lblUploadSub: "लेबल की तस्वीर अपलोड करें या लाइव कैमरा उपयोग करें।",
      lblDropText: "पैकेज लेबल छवि यहाँ डालें",
      lblDropHint: "PNG, JPG, WEBP प्रारूप समर्थित",
      lblPdpArea: "मुख्य प्रदर्शन पैनल क्षेत्रफल (वर्ग सेमी):",
      scanBtn: "विधिक मापविज्ञान सत्यापन चलाएं",
      lblAuditTitle: "पीसीआर 2011 अनुपालन परिणाम",
      verdictPass: "✔ मानक-अनुरूप: सभी घोषणाएं सही हैं",
      verdictFail: "✖ उल्लंघन पाया गया: विधिक नियमों का उल्लंघन",
      reportBtnCitizen: "🚨 स्थानीय प्राधिकरण को रिपोर्ट करें",
      reportBtnOfficer: "🚨 वैधानिक नोटिस जारी करें",
      rules: {
        mrp: "नियम 6(1)(e): अधिकतम खुदरा मूल्य (MRP)",
        net_qty: "नियम 6(1)(c): शुद्ध मात्रा एवं मानक इकाइयाँ",
        mfg_date: "नियम 6(1)(d): पैकिंग या निर्माण की तिथि",
        manufacturer: "नियम 6(1)(a): निर्माता का विवरण व पता",
        consumer_care: "नियम 6(1)(n): उपभोक्ता शिकायत निवारण संपर्क",
        usp: "नियम 6(11): इकाई विक्रय मूल्य (USP)",
        font_compliance: "नियम 7 (तालिका II): अंकों की न्यूनतम ऊंचाई",
        category_statutory: "विशिष्ट वैधानिक श्रेणी सत्यापन"
      },
      rulesDescriptions: {
        mrp: "MRP 'सभी करों सहित' (Inclusive of all taxes) के साथ भारतीय रुपये में होना अनिवार्य है। MRP से अधिक मूल्य वसूलना अपराध है।",
        net_qty: "मात्रा केवल मानक इकाइयों (g, kg, ml, l) में होनी चाहिए। 'gm' या 'ltr' का उपयोग अमान्य है।",
        mfg_date: "उत्पाद के निर्माण या पैकिंग का माह और वर्ष अनिवार्य रूप से लिखा होना चाहिए।",
        manufacturer: "निर्माता या पैकर का पूरा नाम और पंजीकृत पता स्पष्ट होना चाहिए।",
        consumer_care: "शिकायत निवारण के लिए हेल्पलाइन फोन नंबर और ईमेल पता होना अनिवार्य है।",
        usp: "प्रति ग्राम या प्रति मिलीलीटर इकाई विक्रय मूल्य (USP) लिखा होना चाहिए। 1 किग्रा/1 लीटर पर छूट प्राप्त है।",
        font_compliance: "अंकों और अक्षरों की ऊंचाई तालिका II के निर्धारित न्यूनतम मानकों के अनुरूप होनी चाहिए।",
        category_statutory: "श्रेणी के अनुसार खाद्य उत्पादों पर FSSAI, सौंदर्य प्रसाधनों पर M-Lic और इलेक्ट्रॉनिक्स पर मूल देश अनिवार्य है।"
      }
    },
    ta: {
      agencyTitle: "நுகர்வோர் விவகாரங்கள் துறை",
      viewRulesBtn: "📖 PCR 2011 விதிகள்",
      lblTotalScanned: "மொத்த சோதனைகள்",
      lblCompliant: "விதிக்குட்பட்டவை",
      lblViolations: "மீறல்கள்",
      lblUploadTitle: "தயாரிப்பு சான்று பதிவு",
      lblUploadSub: "படத்தை பதிவேற்றவும் அல்லது கேமரா பயன்படுத்தவும்.",
      lblDropText: "படத்தை இங்கே இழுத்துப் போடவும்",
      lblDropHint: "PNG, JPG, WEBP கோப்புகள்",
      lblPdpArea: "காட்சிப் பகுதி (ச.செ.மீ):",
      scanBtn: "சரிபார்ப்பை இயக்கவும்",
      lblAuditTitle: "PCR 2011 ஆய்வு முடிவுகள்",
      verdictPass: "✔ விதிகளுக்கு உட்பட்டது",
      verdictFail: "✖ விதிமீறல்கள் கண்டறியப்பட்டன",
      reportBtnCitizen: "🚨 அதிகாரிகளுக்கு புகார் அனுப்பவும்",
      reportBtnOfficer: "🚨 சட்டப்பூர்வ நோட்டீஸ் அனுப்பவும்",
      rules: {
        mrp: "விதி 6(1)(e): அதிகபட்ச சில்லறை விலை (MRP)",
        net_qty: "விதி 6(1)(c): நிகர எடை & SI அலகுகள்",
        mfg_date: "விதி 6(1)(d): உற்பத்தி மாதம் & வருடம்",
        manufacturer: "விதி 6(1)(a): உற்பத்தியாளர் முகவரி",
        consumer_care: "விதி 6(1)(n): நுகர்வோர் சேவை",
        usp: "விதி 6(11): அலகு விலை (USP)",
        font_compliance: "விதி 7: குறைந்தபட்ச எழுத்து அளவு",
        category_statutory: "வகை சார்ந்த அறிவிப்பு"
      },
      rulesDescriptions: {
        mrp: "அனைத்து வரிகளும் உட்பட MRP இந்திய ரூபாயில் அச்சிடப்பட வேண்டும்.",
        net_qty: "எடை மற்றும் அளவு சர்வதேச SI அலகுகளில் (g, kg, ml, l) மட்டுமே இருக்க வேண்டும்.",
        mfg_date: "உற்பத்தி அல்லது பேக்கிங் செய்யப்பட்ட மாதம் மற்றும் வருடம் தெளிவாக இருக்க வேண்டும்.",
        manufacturer: "உற்பத்தியாளர் அல்லது பேக்கரின் முழுப் பெயர் மற்றும் முகவரி இருக்க வேண்டும்.",
        consumer_care: "நுகர்வோர் குறைதீர்க்க தொலைபேசி எண் மற்றும் மின்னஞ்சல் கட்டாயமாகும்.",
        usp: "விலை ஒப்பீட்டிற்காக ஒரு கிராம் அல்லது மில்லிலிட்டருக்கான அலகு விலை (USP) அச்சிடப்பட வேண்டும்.",
        font_compliance: "எழுத்துக்கள் அட்டவணை II-ன் குறைந்தபட்ச உயர விதிமுறைகளுக்கு உட்பட்டிருக்க வேண்டும்.",
        category_statutory: "FSSAI, அழகு சாதன உரிமம் (M-Lic), மற்றும் உற்பத்தி நாடு அறிவிக்கப்பட வேண்டும்."
      }
    },
    kn: {
      agencyTitle: "ಗ್ರಾಹಕ ವ್ಯವಹಾರಗಳ ಇಲಾಖೆ",
      viewRulesBtn: "📖 PCR 2011 ನಿಯಮಗಳು",
      lblTotalScanned: "ಒಟ್ಟು ಪರಿಶೀಲಿಸಿದ ಉತ್ಪನ್ನಗಳು",
      lblCompliant: "ನಿಯಮಬದ್ಧ ಸರಕುಗಳು",
      lblViolations: "ಉಲ್ಲಂಘನೆಗಳು ಪತ್ತೆಯಾಗಿವೆ",
      lblUploadTitle: "ಉತ್ಪನ್ನ ಪುರಾವೆ ಸೆರೆಹಿಡಿಯುವಿಕೆ",
      lblUploadSub: "ಲೇಬಲ್ ಫೋಟೋ ಅಪ್ಲೋಡ್ ಮಾಡಿ ಅಥವಾ ಕ್ಯಾಮೆರಾ ಬಳಸಿ.",
      lblDropText: "ಪ್ಯಾಕೇಜ್ ಚಿತ್ರವನ್ನು ಇಲ್ಲಿ ಹಾಕಿ",
      lblDropHint: "PNG, JPG, WEBP ಬೆಂಬಲಿತವಾಗಿದೆ",
      lblPdpArea: "ಪ್ರದರ್ಶನ ವಿಸ್ತೀರ್ಣ (ಚ.ಸೆಂ.ಮೀ):",
      scanBtn: "ಪರಿಶೀಲನೆ ಪ್ರಾರಂಭಿಸಿ",
      lblAuditTitle: "PCR 2011 ಪರಿಶೀಲನಾ ಫಲಿತಾಂಶ",
      verdictPass: "✔ ನಿಯಮಾನುಸಾರವಾಗಿದೆ (Compliant)",
      verdictFail: "✖ ನಿಯಮ ಉಲ್ಲಂಘನೆ ಕಂಡುಬಂದಿದೆ",
      reportBtnCitizen: "🚨 ಅಧಿಕಾರಿಗಳಿಗೆ ದೂರು ನೀಡಿ",
      reportBtnOfficer: "🚨 ಶಾಸನಬದ್ಧ ನೋಟಿಸ್ ಜಾರಿಮಾಡಿ",
      rules: {
        mrp: "ನಿಯಮ 6(1)(e): ಗರಿಷ್ಠ ಚಿಲ್ಲರೆ ಬೆಲೆ (MRP)",
        net_qty: "ನಿಯಮ 6(1)(c): ನಿವ್ವಳ ಪ್ರಮಾಣ ಮತ್ತು SI ಮಾಪಕಗಳು",
        mfg_date: "ನಿಯಮ 6(1)(d): ಪ್ಯಾಕಿಂಗ್ ಅಥವಾ ತಯಾರಿಕೆಯ ದಿನಾಂಕ",
        manufacturer: "ನಿಯಮ 6(1)(a): ತಯಾರಕರ ಪೂರ್ಣ ವಿಳಾಸ",
        consumer_care: "ನಿಯಮ 6(1)(n): ಗ್ರಾಹಕ ಸಹಾಯವಾಣಿ ವಿವರ",
        usp: "ನಿಯಮ 6(11): ಯುನಿಟ್ ಮಾರಾಟ ಬೆಲೆ (USP)",
        font_compliance: "ನಿಯಮ 7 (ಕೋಷ್ಟಕ II): ಅಕ್ಷರಗಳ ಕನಿಷ್ಠ ಎತ್ತರ",
        category_statutory: "ವರ್ಗ-ನಿರ್ದಿಷ್ಟ ಶಾಸನಬದ್ಧ ಘೋಷಣೆ"
      },
      rulesDescriptions: {
        mrp: "ಎಲ್ಲಾ ತೆರಿಗೆಗಳು ಸೇರಿದಂತೆ MRP ಭಾರತೀಯ ರೂಪಾಯಿಗಳಲ್ಲಿ ಮುದ್ರಿಸಬೇಕು.",
        net_qty: "ಪ್ರಮಾಣವನ್ನು SI ಮಾಪಕಗಳಲ್ಲಿ (g, kg, ml, l) ಮಾತ್ರ ನಮೂದಿಸಬೇಕು.",
        mfg_date: "ತಯಾರಿಸಿದ ತಿಂಗಳು ಮತ್ತು ವರ್ಷವನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ನಮೂದಿಸಬೇಕು.",
        manufacturer: "ತಯಾರಕ ಅಥವಾ ಪ್ಯಾಕರ್‌ನ ಅಧಿಕೃತ ಹೆಸರು ಮತ್ತು ವಿಳಾಸ ಇರಬೇಕು.",
        consumer_care: "ಗ್ರಾಹಕರ ಪರಿಹಾರಕ್ಕಾಗಿ ಸಹಾಯವಾಣಿ ಮತ್ತು ಇಮೇಲ್ ಕಡ್ಡಾಯವಾಗಿದೆ.",
        usp: "ಬೆಲೆ ಹೋಲಿಕೆಗಾಗಿ ಪ್ರತಿ ಗ್ರಾಂ ಅಥವಾ ಮಿಲಿ ಲೀಟರ್‌ಗೆ ಬೆಲೆ (USP) ನಮೂದಿಸಬೇಕು.",
        font_compliance: "ಅಕ್ಷರಗಳ ಗಾತ್ರವು ಕೋಷ್ಟಕ II ರ ಮಾನದಂಡಗಳಂತೆ ಇರಬೇಕು.",
        category_statutory: "FSSAI, ಸೌಂದರ್ಯವರ್ಧಕ ಪರವಾನಗಿ ಅಥವಾ ಮೂಲ ದೇಶದ ವಿವರ ಕಡ್ಡಾಯ."
      }
    },
    ml: {
      agencyTitle: "ഉപഭോക്തൃകാര്യ വകുപ്പ്",
      viewRulesBtn: "📖 PCR 2011 ചട്ടങ്ങൾ",
      lblTotalScanned: "ആകെ പരിശോധിച്ചവ",
      lblCompliant: "ചട്ടപ്രകാരമുള്ളവ",
      lblViolations: "ലംഘനങ്ങൾ കണ്ടെത്തി",
      lblUploadTitle: "ഉൽപ്പന്ന തെളിവ് ശേഖരണം",
      lblUploadSub: "ലേബൽ ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുക അല്ലെങ്കിൽ ക്യാമറ ഉപയോഗിക്കുക.",
      lblDropText: "പാക്കേജ് ചിത്രം ഇവിടെ നൽകുക",
      lblDropHint: "PNG, JPG, WEBP ഫയലുകൾ പിന്തുണയ്ക്കുന്നു",
      lblPdpArea: "പ്രദർശന വിസ്തീർണ്ണം (ച.സെ.മീ):",
      scanBtn: "പരിശോധന ആരംഭിക്കുക",
      lblAuditTitle: "PCR 2011 ഓഡിറ്റ് ഫലം",
      verdictPass: "✔ ചട്ടപ്രകാരമുള്ളതാണ് (Compliant)",
      verdictFail: "✖ ചട്ടലംഘനം കണ്ടെത്തി",
      reportBtnCitizen: "🚨 അധികാരികൾക്ക് പരാതി നൽകുക",
      reportBtnOfficer: "🚨 നോട്ടീസ് അയക്കുക",
      rules: {
        mrp: "റൂൾ 6(1)(e): പരമാവധി റീട്ടെയിൽ വില (MRP)",
        net_qty: "റൂൾ 6(1)(c): കൃത്യമായ അളവും യൂണിറ്റുകളും",
        mfg_date: "റൂൾ 6(1)(d): നിർമ്മാണ തീയതി",
        manufacturer: "റൂൾ 6(1)(a): നിർമ്മാതാവിന്റെ വിലാസം",
        consumer_care: "റൂൾ 6(1)(n): കസ്റ്റമർ കെയർ",
        usp: "റൂൾ 6(11): യൂണിറ്റ് വിൽപ്പന വില (USP)",
        font_compliance: "റൂൾ 7: അക്ഷരങ്ങളുടെ വലിപ്പം",
        category_statutory: "നിയമപരമായ പ്രഖ്യാപനങ്ങൾ"
      },
      rulesDescriptions: {
        mrp: "എല്ലാ നികുതികളും ഉൾപ്പെടെ വില രേഖപ്പെടുത്തണം.",
        net_qty: "അളവുകൾ മെട്രിക് യൂണിറ്റുകളിൽ (g, kg, ml, l) ആയിരിക്കണം.",
        mfg_date: "നിർമ്മാണ മാസം, വർഷം എന്നിവ നിർബന്ധമാണ്.",
        manufacturer: "നിർമ്മാതാവിന്റെ പൂർണ്ണമായ പേരും വിലാസവും ഉണ്ടായിരിക്കണം.",
        consumer_care: "ഉപഭോക്തൃ സഹായത്തിന് ഫോൺ നമ്പറും ഇമെയിലും വേണം.",
        usp: "യൂണിറ്റ് വിൽപ്പന വില രേഖപ്പെടുത്തണം.",
        font_compliance: "അക്ഷരങ്ങളുടെ ഉയരം ടേബിൾ II മാനദണ്ഡങ്ങൾ പാലിക്കണം.",
        category_statutory: "FSSAI, കോസ്മെറ്റിക് ലൈസൻസ്, നിർമ്മിത രാജ്യം എന്നിവ രേഖപ്പെടുത്തണം."
      }
    },
    mr: {
      agencyTitle: "ग्राहक व्यवहार विभाग",
      viewRulesBtn: "📖 PCR 2011 नियम",
      lblTotalScanned: "एकूण तपासलेली उत्पादने",
      lblCompliant: "नियमांनुसार उत्पादने",
      lblViolations: "नियमभंग आढळले",
      lblUploadTitle: "उत्पादन पुरावा संकलन",
      lblUploadSub: "पॅकेजिंगचा फोटो अपलोड करा किंवा कॅमेरा वापरा.",
      lblDropText: "पॅकेजची प्रतिमा येथे ठेवा",
      lblDropHint: "PNG, JPG, WEBP समर्थित",
      lblPdpArea: "पॅनेलचे क्षेत्रफळ (चौ.सेमी):",
      scanBtn: "पडताळणी सुरू करा",
      lblAuditTitle: "PCR 2011 तपासणी निकाल",
      verdictPass: "✔ नियमांनुसार प्रमाणित (Compliant)",
      verdictFail: "✖ नियमभंग आढळले",
      reportBtnCitizen: "🚨 तक्रार नोंदवा",
      reportBtnOfficer: "🚨 कायदेशीर नोटीस जारी करा",
      rules: {
        mrp: "नियम 6(1)(e): कमाल किरकोळ किंमत (MRP)",
        net_qty: "नियम 6(1)(c): निव्वळ प्रमाण आणि SI एकके",
        mfg_date: "नियम 6(1)(d): उत्पादन महिना आणि वर्ष",
        manufacturer: "नियम 6(1)(a): उत्पादकाचा पत्ता",
        consumer_care: "नियम 6(1)(n): ग्राहक सेवा संपर्क",
        usp: "नियम 6(11): प्रति युनिट विक्री किंमत (USP)",
        font_compliance: "नियम 7: फॉन्टची किमान उंची",
        category_statutory: "वैधानिक घोषणा"
      },
      rulesDescriptions: {
        mrp: "सर्व करांसहित कमाल किरकोळ किंमत छापणे आवश्यक आहे.",
        net_qty: "प्रमाण फक्त मानक एककांमध्ये (g, kg, ml, l) असावे.",
        mfg_date: "पॅकिंगचा महिना आणि वर्ष स्पष्ट असणे आवश्यक आहे.",
        manufacturer: "उत्पादक किंवा पॅकरचे नाव आणि पत्ता असणे बंधनकारक आहे.",
        consumer_care: "ग्राहक तक्रार निवारणासाठी फोन आणि ईमेल आवश्यक आहे.",
        usp: "किंमत तुलनेसाठी प्रति ग्रॅम/मिली विक्री किंमत आवश्यक आहे.",
        font_compliance: "अक्षरांची उंची तक्ता II नुसार असणे आवश्यक आहे.",
        category_statutory: "FSSAI, सौंदर्यप्रसाधन परवाना किंवा मूळ देशाची नोंद असणे आवश्यक आहे."
      }
    },
    gu: {
      agencyTitle: "ગ્રાહક બાબતોનો વિભાગ",
      viewRulesBtn: "📖 PCR 2011 નિયમો",
      lblTotalScanned: "કુલ સ્કેન કરેલ ઉત્પાદનો",
      lblCompliant: "નિયમબદ્ધ ઉત્પાદનો",
      lblViolations: "નિયમભંગ મળ્યા",
      lblUploadTitle: "લેબલ પુરાવા સંગ્રહ",
      lblUploadSub: "ફોટો અપલોડ કરો અથવા કેમેરા વાપરો.",
      lblDropText: "પેકેજ ફોટો અહીં મૂકો",
      lblDropHint: "PNG, JPG, WEBP ફોર્મેટ સપોર્ટેડ",
      lblPdpArea: "ડિસ્પ્લે વિસ્તાર (ચો.સેમી):",
      scanBtn: "ચકાસણી ચલાવો",
      lblAuditTitle: "PCR 2011 ઓડિટ પરિણામ",
      verdictPass: "✔ નિયમો મુજબ યોગ્ય છે",
      verdictFail: "✖ નિયમભંગ મળ્યા",
      reportBtnCitizen: "🚨 ફરિયાદ નોંધાવો",
      reportBtnOfficer: "🚨 કાનૂની નોટિસ આપો",
      rules: {
        mrp: "નિયમ 6(1)(e): મહત્તમ છૂટક કિંમત (MRP)",
        net_qty: "નિયમ 6(1)(c): ચોખ્ખો જથ્થો",
        mfg_date: "નિયમ 6(1)(d): ઉત્પાદન તારીખ",
        manufacturer: "નિયમ 6(1)(a): ઉત્પાદકનું સરનામું",
        consumer_care: "નિયમ 6(1)(n): ગ્રાહક સેવા વિગત",
        usp: "નિયમ 6(11): યુનિટ વેચાણ કિંમત (USP)",
        font_compliance: "નિયમ 7: અક્ષરોની ઊંચાઈ",
        category_statutory: "વૈધાનિક ઘોષણા"
      },
      rulesDescriptions: {
        mrp: "તમામ કર સહિત MRP છાપવી ફરજિયાત છે.",
        net_qty: "જથ્થો પ્રમાણિત મેટ્રિક એકમોમાં હોવો જોઈએ.",
        mfg_date: "પેકિંગનો મહિનો અને વર્ષ સ્પષ્ટ હોવા જોઈએ.",
        manufacturer: "ઉત્પાદકનું પૂરું નામ અને ભૌગોલિક સરનામું હોવું જોઈએ.",
        consumer_care: "ગ્રાહક સહાય માટે હેલ્પલાઇન અને ઇમેઇલ જરૂરી છે.",
        usp: "પ્રતિ ગ્રામ અથવા મિલી યુનિટ કિંમત જાહેર કરવી જોઈએ.",
        font_compliance: "અક્ષરોનું કદ ટેબલ II મુજબ હોવું જોઈએ.",
        category_statutory: "FSSAI અથવા મૂળ દેશની વિગત હોવી જરૂરી છે."
      }
    },
    bn: {
      agencyTitle: "ভোক্তা বিষয়ক বিভাগ",
      viewRulesBtn: "📖 PCR 2011 নিয়মাবলী",
      lblTotalScanned: "মোট যাচাইকৃত পণ্য",
      lblCompliant: "নিয়মসম্মত পণ্য",
      lblViolations: "লঙ্ঘন সনাক্ত হয়েছে",
      lblUploadTitle: "প্যাকেজ প্রমাণ সংগ্রহ",
      lblUploadSub: "প্যাকেজের ছবি আপলোড করুন অথবা ক্যামেরা ব্যবহার করুন।",
      lblDropText: "প্যাকেজের ছবি এখানে রাখুন",
      lblDropHint: "PNG, JPG, WEBP সমর্থিত",
      lblPdpArea: "ডিসপ্লে এলাকার ক্ষেত্রফল (বর্গ সেমি):",
      scanBtn: "যাচাইকরণ শুরু করুন",
      lblAuditTitle: "PCR 2011 নিরীক্ষা ফলাফল",
      verdictPass: "✔ নিয়ম মেনে তৈরি (Compliant)",
      verdictFail: "✖ নিয়ম লঙ্ঘন সনাক্ত হয়েছে",
      reportBtnCitizen: "🚨 কর্তৃপক্ষের কাছে অভিযোগ জানান",
      reportBtnOfficer: "🚨 আইনি নোটিশ পাঠান",
      rules: {
        mrp: "নিয়ম 6(1)(e): সর্বোচ্চ খুচরা মূল্য (MRP)",
        net_qty: "নিয়ম 6(1)(c): নেট পরিমাণ ও একক",
        mfg_date: "নিয়ম 6(1)(d): উৎপাদনের তারিখ",
        manufacturer: "নিয়ম 6(1)(a): প্রস্তুতকারকের ঠিকানা",
        consumer_care: "নিয়ম 6(1)(n): কাস্টমার কেয়ার",
        usp: "নিয়ম 6(11): ইউনিট বিক্রয় মূল্য (USP)",
        font_compliance: "নিয়ম 7: অক্ষরের উচ্চতা",
        category_statutory: "বিধিবদ্ধ বিভাগীয় ঘোষণা"
      },
      rulesDescriptions: {
        mrp: "সমস্ত কর সহ MRP ভারতীয় টাকায় মুদ্রিত হতে হবে।",
        net_qty: "পরিমাণ অবশ্যই আন্তর্জাতিক SI এককে (g, kg, ml, l) হতে হবে।",
        mfg_date: "প্যাকিং বা প্রস্তুতের মাস ও বছর পরিষ্কার থাকতে হবে।",
        manufacturer: "প্রস্তুতকারক বা প্যাকার এর নাম ও সম্পূর্ণ ঠিকানা থাকা আবশ্যক।",
        consumer_care: "অভিযোগ প্রতিকারের জন্য হেল্পলাইন এবং ইমেল আবশ্যক।",
        usp: "প্রতি গ্রাম বা মিলি লিটার প্রতি ইউনিট দাম লেখা বাধ্যতামূলক।",
        font_compliance: "অক্ষরের উচ্চতা টেবিল II এর ন্যূনতম মানদণ্ড অনুযায়ী হতে হবে।",
        category_statutory: "খাদ্যে FSSAI, প্রসাধনীতে M-Lic এবং ইলেকট্রনিক্সে প্রস্তুতকারক দেশ আবশ্যক।"
      }
    },
    pa: {
      agencyTitle: "ਖਪਤਕਾਰ ਮਾਮਲੇ ਵਿਭਾਗ",
      viewRulesBtn: "📖 PCR 2011 ਨਿਯਮ",
      lblTotalScanned: "ਕੁੱਲ ਜਾਂਚ ਕੀਤੇ ਉਤਪਾਦ",
      lblCompliant: "ਨਿਯਮ ਅਨੁਸਾਰ ਉਤਪਾਦ",
      lblViolations: "ਨਿਯਮ ਉਲੰਘਣਾ ਮਿਲੀ",
      lblUploadTitle: "ਲੇਬਲ ਸਬੂਤ ਸੰਗ੍ਰਹਿ",
      lblUploadSub: "ਫੋਟੋ ਅਪਲੋਡ ਕਰੋ ਜਾਂ ਲਾਈਵ ਕੈਮਰਾ ਵਰਤੋ।",
      lblDropText: "ਪੈਕੇਟ ਦੀ ਫੋਟੋ ਇੱਥੇ ਰੱਖੋ",
      lblDropHint: "PNG, JPG, WEBP ਸਮਰਥਿਤ",
      lblPdpArea: "ਡਿਸਪਲੇਅ ਖੇਤਰ (ਵਰਗ ਸੈ.ਮੀ.):",
      scanBtn: "ਜਾਂਚ ਸ਼ੁਰੂ ਕਰੋ",
      lblAuditTitle: "PCR 2011 ਜਾਂਚ ਨਤੀਜਾ",
      verdictPass: "✔ ਨਿਯਮਾਂ ਅਨੁਸਾਰ ਸਹੀ ਹੈ",
      verdictFail: "✖ ਨਿਯਮਾਂ ਦੀ ਉਲੰਘਣਾ ਪਾਈ ਗਈ",
      reportBtnCitizen: "🚨 ਅਧਿਕਾਰੀਆਂ ਨੂੰ ਸ਼ਿਕਾਇਤ ਕਰੋ",
      reportBtnOfficer: "🚨 ਕਾਨੂੰਨੀ ਨੋਟਿਸ ਜਾਰੀ ਕਰੋ",
      rules: {
        mrp: "ਨਿਯਮ 6(1)(e): ਵੱਧ ਤੋਂ ਵੱਧ ਪ੍ਰਚੂਨ ਮੁੱਲ (MRP)",
        net_qty: "ਨਿਯਮ 6(1)(c): ਕੁੱਲ ਮਾਤਰਾ ਅਤੇ ਇਕਾਈਆਂ",
        mfg_date: "ਨਿਯਮ 6(1)(d): ਨਿਰਮਾਣ ਦੀ ਮਿਤੀ",
        manufacturer: "ਨਿਯਮ 6(1)(a): ਨਿਰਮਾਤਾ ਦਾ ਪਤਾ",
        consumer_care: "ਨਿਯਮ 6(1)(n): ਗਾਹਕ ਸੇਵਾ ਵੇਰਵਾ",
        usp: "ਨਿਯਮ 6(11): ਪ੍ਰਤੀ ਯੂਨਿਟ ਵਿਕਰੀ ਮੁੱਲ (USP)",
        font_compliance: "ਨਿਯਮ 7: ਅੱਖਰਾਂ ਦਾ ਆਕਾਰ",
        category_statutory: "ਕਾਨੂੰਨੀ ਘੋਸ਼ਣਾ"
      },
      rulesDescriptions: {
        mrp: "ਸਾਰੇ ਟੈਕਸਾਂ ਸਮੇਤ MRP ਲਿਖਿਆ ਹੋਣਾ ਜ਼ਰੂਰੀ ਹੈ।",
        net_qty: "ਮਾਤਰਾ ਸਿਰਫ ਮਿਆਰੀ ਮੀਟ੍ਰਿਕ ਇਕਾਈਆਂ ਵਿੱਚ ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ।",
        mfg_date: "ਪੈਕਿੰਗ ਦਾ ਮਹੀਨਾ ਅਤੇ ਸਾਲ ਸਪੱਸ਼ਟ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।",
        manufacturer: "ਨਿਰਮਾਤਾ ਦਾ ਪੂਰਾ ਨਾਮ ਅਤੇ ਪਤਾ ਲਿਖਿਆ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।",
        consumer_care: "ਸ਼ਿਕਾਇਤ ਲਈ ਫੋਨ ਨੰਬਰ ਅਤੇ ਈਮੇਲ ਹੋਣੀ ਲਾਜ਼ਮੀ ਹੈ।",
        usp: "ਪ੍ਰਤੀ ਗ੍ਰਾਮ ਜਾਂ ਮਿਲੀਲੀਟਰ ਯੂਨਿਟ ਮੁੱਲ ਲਿਖਣਾ ਜ਼ਰੂਰੀ ਹੈ।",
        font_compliance: "ਅੱਖਰਾਂ ਦੀ ਉਚਾਈ ਟੇਬਲ II ਦੇ ਨਿਯਮਾਂ ਅਨੁਸਾਰ ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ।",
        category_statutory: "FSSAI ਜਾਂ ਮੂਲ ਦੇਸ਼ ਦਾ ਵੇਰਵਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।"
      }
    },
    or: {
      agencyTitle: "ଖାଉଟି ବ୍ୟାପାର ବିଭାଗ",
      viewRulesBtn: "📖 PCR 2011 ନିୟମାବଳୀ",
      lblTotalScanned: "ମୋଟ ଯାଞ୍ଚ ହୋଇଥିବା ସାମଗ୍ରୀ",
      lblCompliant: "ନିୟମାନୁସାରୀ ସାମଗ୍ରୀ",
      lblViolations: "ନିୟମ ଉଲ୍ଲଂଘନ ମିଳିଲା",
      lblUploadTitle: "ପ୍ୟାକେଜିଂ ପ୍ରମାଣ ସଂଗ୍ରହ",
      lblUploadSub: "ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ କିମ୍ବା କ୍ୟାମେରା ବ୍ୟବହାର କରନ୍ତୁ।",
      lblDropText: "ପ୍ୟାକେଟ ଫଟୋ ଏଠାରେ ରଖନ୍ତୁ",
      lblDropHint: "PNG, JPG, WEBP ସମର୍ଥିତ",
      lblPdpArea: "କ୍ଷେତ୍ରଫଳ (ବର୍ଗ ସେମି):",
      scanBtn: "ଯାଞ୍ଚ ଆରମ୍ଭ କରନ୍ତୁ",
      lblAuditTitle: "PCR 2011 ଅଡିଟ୍ ଫଳାଫଳ",
      verdictPass: "✔ ନିୟମ ଅନୁସାରେ ସଠିକ୍ ଅଛି",
      verdictFail: "✖ ନିୟମ ଉଲ୍ଲଂଘନ ଚିହ୍ନଟ ହୋଇଛି",
      reportBtnCitizen: "🚨 ଅଧିକାରୀଙ୍କୁ ଅଭିଯୋଗ କରନ୍ତୁ",
      reportBtnOfficer: "🚨 ଆଇନଗତ ନୋଟିସ୍ ପଠାନ୍ତୁ",
      rules: {
        mrp: "ନିୟମ 6(1)(e): ସର୍ବାଧିକ ଖୁଚୁରା ମୂଲ୍ୟ (MRP)",
        net_qty: "ନିୟମ 6(1)(c): ନିଟ୍ ପରିମାଣ",
        mfg_date: "ନିୟମ 6(1)(d): ଉତ୍ପାଦନ ତାରିଖ",
        manufacturer: "ନିୟମ 6(1)(a): ନିର୍ମାତାଙ୍କ ଠିକଣା",
        consumer_care: "ନିୟମ 6(1)(n): ଗ୍ରାହକ ସେବା ବିବରଣୀ",
        usp: "ନିୟମ 6(11): ୟୁନିଟ୍ ବିକ୍ରି ମୂଲ୍ୟ (USP)",
        font_compliance: "ନିୟମ 7: ଅକ୍ଷରର ଉଚ୍ଚତା",
        category_statutory: "ବିଭାଗୀୟ ଆଇନଗତ ଘୋଷଣା"
      },
      rulesDescriptions: {
        mrp: "ସମସ୍ତ ଟ୍ୟାକ୍ସ ସହିତ MRP ଉଲ୍ଲେଖ ଥିବା ବାଧ୍ୟତାମୂଳକ।",
        net_qty: "ପରିମାଣ କେବଳ SI ଏକକରେ ରହିବା ଉଚିତ।",
        mfg_date: "ପ୍ୟାକିଂ ମାସ ଏବଂ ବର୍ଷ ସ୍ପଷ୍ଟ ହେବା ଆବଶ୍ୟକ।",
        manufacturer: "ଉତ୍ପାଦକଙ୍କ ପୂରା ନାମ ଏବଂ ଠିକଣା ରହିବା ଆବଶ୍ୟକ।",
        consumer_care: "ଅଭିଯୋଗ ନିବାରଣ ପାଇଁ ହେଲ୍ପଲାଇନ ନମ୍ବର ଏବଂ ଇମେଲ୍ ଜରୁରୀ।",
        usp: "ମୂଲ୍ୟ ତୁଳନା ପାଇଁ ପ୍ରତି ଗ୍ରାମ/ମିଲି ମୂଲ୍ୟ ଦର୍ଶାନ୍ତୁ।",
        font_compliance: "ଅକ୍ଷରର ଉଚ୍ଚତା ଟେବୁଲ୍ II ମାନଦଣ୍ଡ ଅନୁଯାୟୀ ହେବା ଉଚିତ।",
        category_statutory: "FSSAI କିମ୍ବା ଉତ୍ପାଦନକାରୀ ଦେଶର ଉଲ୍ଲେଖ ରହିବା ଉଚିତ।"
      }
    },
    ur: {
      agencyTitle: "محکمہ امور صارفین",
      viewRulesBtn: "📖 پی سی آر 2011 قواعد",
      lblTotalScanned: "کل معائنہ شدہ مصنوعات",
      lblCompliant: "قواعد کے مطابق مصنوعات",
      lblViolations: "خلاف ورزیاں پائی گئیں",
      lblUploadTitle: "پیکیجنگ ثبوت ریکارڈ",
      lblUploadSub: "تصویر اپ لوڈ کریں یا کیمرہ استعمال کریں۔",
      lblDropText: "پیکیج کی تصویر یہاں ڈالیں",
      lblDropHint: "PNG, JPG, WEBP فارمیٹس",
      lblPdpArea: "ڈسپلے ایریا (مربع سینٹی میٹر):",
      scanBtn: "قانونی معائنہ شروع کریں",
      lblAuditTitle: "پی سی آر 2011 آڈٹ نتائج",
      verdictPass: "✔ قواعد کے مطابق درست ہے",
      verdictFail: "✖ خلاف ورزیاں پائی گئیں",
      reportBtnCitizen: "🚨 حکام کو شکایت درج کریں",
      reportBtnOfficer: "🚨 قانونی نوٹس جاری کریں",
      rules: {
        mrp: "قاعدہ 6(1)(e): زیادہ سے زیادہ خوردہ قیمت (MRP)",
        net_qty: "قاعدہ 6(1)(c): خالص مقدار اور اکائیاں",
        mfg_date: "قاعدہ 6(1)(d): تیاری کی تاریخ",
        manufacturer: "قاعدہ 6(1)(a): مینوفیکچرر کا پتہ",
        consumer_care: "قاعدہ 6(1)(n): کسٹمر کیئر",
        usp: "قاعدہ 6(11): فی یونٹ فروخت کی قیمت (USP)",
        font_compliance: "قاعدہ 7: حروف کا سائز",
        category_statutory: "قانونی زمرے کی توثیق"
      },
      rulesDescriptions: {
        mrp: "تمام ٹیکسوں سمیت قیمت ہندوستانی روپے میں ہونی چاہیے۔",
        net_qty: "مقدار صرف معیاری اعشاری اکائیوں (g, kg, ml, l) میں ہونی چاہیے۔",
        mfg_date: "تیاری یا پیکنگ کا مہینہ اور سال واضح ہونا چاہیے۔",
        manufacturer: "مینوفیکچرر کا پورا نام اور رجسٹرڈ پتہ ہونا ضروری ہے۔",
        consumer_care: "شکایات کے ازالے کے لیے فون نمبر اور ای میل درج ہونا ضروری ہے۔",
        usp: "قیمت کے موازنہ کے لیے فی گرام یا ملی لیٹر قیمت لکھنا ضروری ہے۔",
        font_compliance: "حروف کا سائز جدول II کے معیار کے مطابق ہونا چاہیے۔",
        category_statutory: "FSSAI لائسنس یا ملک کا نام درج ہونا ضروری ہے۔"
      }
    }
  };

  // -------------------------------------------------------------
  // 4. APPLICATION STATE & DOM REFERENCES
  // -------------------------------------------------------------
  let currentSession = { role: "CITIZEN", userIdentifier: "GUEST_CITIZEN", state: "Delhi", district: "New Delhi", pincode: "110001", complaintsCount: 0 };
  let auditHistory = [];
  let selectedFile = null;
  let selectedFiles = [];
  let scanning = false;
  let backendOnline = false;
  let currentImage = new Image();
  let activeLanguage = "en";
  let videoStream = null;
  let lastScanResult = null;

  const roleGatewayModal = document.getElementById("roleGatewayModal");
  const tabCitizenBtn = document.getElementById("tabCitizenBtn");
  const tabOfficerBtn = document.getElementById("tabOfficerBtn");
  const citizenLoginForm = document.getElementById("citizenLoginForm");
  const officerLoginForm = document.getElementById("officerLoginForm");
  const citizenIdentityInput = document.getElementById("citizenIdentityInput");
  const citizenIdentityError = document.getElementById("citizenIdentityError");
  const citizenOtpInput = document.getElementById("citizenOtpInput");
  const citizenOtpError = document.getElementById("citizenOtpError");
  const officerIdInput = document.getElementById("officerIdInput");
  const officerStateSelect = document.getElementById("officerStateSelect");

  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const sideDrawer = document.getElementById("sideDrawer");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const drawerCloseBtn = document.getElementById("drawerCloseBtn");
  const drawerRepoLink = document.getElementById("drawerRepoLink");

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const languageSelector = document.getElementById("languageSelector");

  const stateDropdown = document.getElementById("stateDropdown");
  const districtDropdown = document.getElementById("districtDropdown");
  const pincodeInput = document.getElementById("pincodeInput");
  const refreshLocationBtn = document.getElementById("refreshLocationBtn");
  const locStatus = document.getElementById("locStatus");

  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const scanButton = document.getElementById("scanButton");
  const previewContainer = document.getElementById("previewContainer");
  const canvas = document.getElementById("detectionCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const packageAreaInput = document.getElementById("packageArea");
  const ocrEngineButtons = Array.from(document.querySelectorAll('[data-ocr-engine]'));
  const savedOCREngine = localStorage.getItem('metrology_ocr_engine');
  let selectedOCREngine = ['paddleocr', 'tesseract', 'hybrid'].includes(savedOCREngine) ? savedOCREngine : 'hybrid';
  function renderOCREngineChoice() {
    ocrEngineButtons.forEach(button => {
      const selected = button.dataset.ocrEngine === selectedOCREngine;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = scanning;
    });
  }
  ocrEngineButtons.forEach(button => listen(button, 'click', () => {
    if (scanning) return;
    selectedOCREngine = button.dataset.ocrEngine;
    localStorage.setItem('metrology_ocr_engine', selectedOCREngine);
    renderOCREngineChoice();
  }));
  renderOCREngineChoice();


  const modeUploadBtn = document.getElementById("modeUploadBtn");
  const modeCameraBtn = document.getElementById("modeCameraBtn");
  const cameraContainer = document.getElementById("cameraContainer");
  const videoFeed = document.getElementById("videoFeed");
  const captureBtn = document.getElementById("captureBtn");

  const complianceVerdict = document.getElementById("complianceVerdict");
  const caseIdBadge = document.getElementById("caseIdBadge");
  const rulesList = document.getElementById("rulesList");
  const downloadPdfBtn = document.getElementById("downloadPdfBtn");
  const fileComplaintBtn = document.getElementById("fileComplaintBtn");
  const detectedSymbolsBox = document.getElementById("detectedSymbolsBox");
  const symbolsChipsList = document.getElementById("symbolsChipsList");

  const dispatchNoticeModal = document.getElementById("dispatchNoticeModal");
  const closeDispatchModal = document.getElementById("closeDispatchModal");
  const dispatchForm = document.getElementById("dispatchForm");
  const dispatchTargetSelect = document.getElementById("dispatchTargetSelect");
  const dispatchContactInput = document.getElementById("dispatchContactInput");

  const rulesModal = document.getElementById("rulesModal");
  const viewRulesBtn = document.getElementById("viewRulesBtn");
  const closeRulesModal = document.getElementById("closeRulesModal");
  const rulesListModalContent = document.getElementById("rulesListModalContent");

  const aiFab = document.getElementById("aiFab");
  const aiChatWindow = document.getElementById("aiChatWindow");
  const chatCloseBtn = document.getElementById("chatCloseBtn");
  const chatTextInput = document.getElementById("chatTextInput");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const chatMessages = document.getElementById("chatMessages");

  const repoSearchInput = document.getElementById("repoSearchInput");
  const historyTableBody = document.getElementById("historyTableBody");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const exportJsonBtn = document.getElementById("exportJsonBtn");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const repositorySection = document.getElementById("repositorySection");
  const userInfo = document.getElementById("userInfo");
  const officerName = document.getElementById("officerName");
  const logoutBtn = document.getElementById("logoutBtn");

  // -------------------------------------------------------------
  // 5. 3D FLOATING PACKAGING PHYSICS ENGINE (Interactive Canvas)
  // -------------------------------------------------------------
  const pkgCanvas = document.getElementById("packagesCanvas");
  if (pkgCanvas) {
    const pctx = pkgCanvas.getContext("2d");
    let cw = (pkgCanvas.width = window.innerWidth);
    let ch = (pkgCanvas.height = window.innerHeight);

    listen(window, "resize", () => {
      cw = pkgCanvas.width = window.innerWidth;
      ch = pkgCanvas.height = window.innerHeight;
    });

    const emojis = ["🌾", "🍚", "🥛", "📦", "🥫", "🧴", "🧃", "🍪", "🍫", "🏷️", "☕", "🧼", "🧈", "🫒"];
    const pkgs = [];
    for (let i = 0; i < 28; i++) {
      pkgs.push({
        x: Math.random() * cw,
        y: Math.random() * ch,
        vx: (Math.random() - 0.5) * 0.75,
        vy: (Math.random() - 0.5) * 0.75,
        size: Math.random() * 24 + 18,
        emoji: emojis[i % emojis.length],
        depth: Math.random() * 0.6 + 0.4
      });
    }

    let mouseX = cw / 2;
    let mouseY = ch / 2;
    listen(window, "mousemove", (e) => { mouseX = e.clientX; mouseY = e.clientY; });
    listen(window, "touchmove", (e) => {
      if (e.touches && e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
      }
    });

    function renderPhysics() {
      if (document.hidden || roleGatewayModal.style.display === "none" || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        later(renderPhysics, 500);
        return;
      }
      pctx.clearRect(0, 0, cw, ch);
      for (let i = 0; i < pkgs.length; i++) {
        const p = pkgs[i];
        p.x += p.vx * p.depth;
        p.y += p.vy * p.depth;
        if (p.x < -40) p.x = cw + 40;
        if (p.x > cw + 40) p.x = -40;
        if (p.y < -40) p.y = ch + 40;
        if (p.y > ch + 40) p.y = -40;

        const dist = Math.hypot(mouseX - p.x, mouseY - p.y);
        if (dist > 0 && dist < 160) {
          const f = (160 - dist) / 160;
          p.x -= ((mouseX - p.x) / dist) * f * 2.8;
          p.y -= ((mouseY - p.y) / dist) * f * 2.8;
        }

        pctx.font = String(p.size * p.depth) + "px serif";
        pctx.textAlign = "center";
        pctx.textBaseline = "middle";
        pctx.globalAlpha = 0.42 * p.depth;
        pctx.fillText(p.emoji, p.x, p.y);
      }
      frame(renderPhysics);
    }
    renderPhysics();
  }

  // -------------------------------------------------------------
  // 6. ROLE GATEWAY & SSO CONTROLLER
  // -------------------------------------------------------------
  if (tabCitizenBtn && tabOfficerBtn) {
    listen(tabCitizenBtn, "click", () => {
      tabCitizenBtn.classList.add("active");
      tabOfficerBtn.classList.remove("active");
      citizenLoginForm.style.display = "block";
      officerLoginForm.style.display = "none";
    });

    listen(tabOfficerBtn, "click", () => {
      tabOfficerBtn.classList.add("active");
      tabCitizenBtn.classList.remove("active");
      officerLoginForm.style.display = "block";
      citizenLoginForm.style.display = "none";
    });
  }

  function validateCitizenIdentity(val) {
    const raw = (val || "").trim();
    if (!raw) {
      return { valid: false, message: "Please enter your 10-digit mobile number or email address." };
    }

    // Check if input represents a mobile number (numeric digits, optional spaces, hyphens, or +91 prefix)
    const digitsOnly = raw.replace(/[\s\-\+]/g, "");
    const isDigits = /^\d+$/.test(digitsOnly);

    if (isDigits) {
      let mob = digitsOnly;
      if (mob.length === 12 && mob.startsWith("91")) {
        mob = mob.substring(2);
      }
      if (mob.length === 10) {
        if (/^[6-9]\d{9}$/.test(mob)) {
          return { valid: true, type: "MOBILE", value: mob };
        } else {
          return { valid: false, message: "Mobile number must begin with 6, 7, 8, or 9 (Indian telecommunication standard)." };
        }
      } else {
        return { valid: false, message: `Mobile number must be exactly 10 digits (currently ${mob.length} digits).` };
      }
    }

    // Treat as Email address
    // Strict requirement: must contain username, @, domain name, and valid extension (.com, .gov.in, .nic.in, etc.)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (raw.includes("@")) {
      if (emailRegex.test(raw)) {
        return { valid: true, type: "EMAIL", value: raw.toLowerCase() };
      } else {
        return { valid: false, message: "Invalid email format. Email must end with a valid domain (e.g., name@gmail.com, user@gov.in)." };
      }
    }

    return { valid: false, message: "Invalid input. Please enter a valid 10-digit mobile number or an email ending with @gmail.com, @gov.in, etc." };
  }

  if (citizenLoginForm) {
    if (citizenIdentityInput) {
      listen(citizenIdentityInput, "input", () => {
        if (citizenIdentityError && citizenIdentityError.style.display !== "none") {
          const res = validateCitizenIdentity(citizenIdentityInput.value);
          if (res.valid) {
            citizenIdentityError.style.display = "none";
            citizenIdentityInput.classList.remove("input-invalid");
          }
        }
      });
    }

    if (citizenOtpInput) {
      listen(citizenOtpInput, "input", () => {
        if (citizenOtpError && citizenOtpError.style.display !== "none") {
          if (/^\d{4,6}$/.test(citizenOtpInput.value.trim())) {
            citizenOtpError.style.display = "none";
            citizenOtpInput.classList.remove("input-invalid");
          }
        }
      });
    }

    listen(citizenLoginForm, "submit", (e) => {
      e.preventDefault();

      // Validate Identity (Mobile or Email)
      const valRes = validateCitizenIdentity(citizenIdentityInput.value);
      if (!valRes.valid) {
        if (citizenIdentityError) {
          citizenIdentityError.textContent = "❌ " + valRes.message;
          citizenIdentityError.style.display = "block";
        }
        citizenIdentityInput.classList.add("input-invalid");
        citizenIdentityInput.focus();
        return;
      } else {
        if (citizenIdentityError) citizenIdentityError.style.display = "none";
        citizenIdentityInput.classList.remove("input-invalid");
      }

      // Validate OTP (Mock 26034 or 4-6 digits)
      const otpVal = (citizenOtpInput ? citizenOtpInput.value.trim() : "");
      if (!otpVal || !/^\d{4,6}$/.test(otpVal)) {
        if (citizenOtpError) {
          citizenOtpError.textContent = "❌ Please enter a valid 5-digit OTP (Mock default: 26034).";
          citizenOtpError.style.display = "block";
        }
        if (citizenOtpInput) {
          citizenOtpInput.classList.add("input-invalid");
          citizenOtpInput.focus();
        }
        return;
      } else {
        if (citizenOtpError) citizenOtpError.style.display = "none";
        if (citizenOtpInput) citizenOtpInput.classList.remove("input-invalid");
      }

      const id = valRes.value;
      currentSession.role = "CITIZEN";
      currentSession.userIdentifier = id;
      roleGatewayModal.style.display = "none";

      if (userInfo) userInfo.style.display = "flex";
      if (officerName) officerName.textContent = "Citizen: " + (valRes.type === "MOBILE" ? ("+91 " + id) : id.substring(0, 16));
      if (repositorySection) repositorySection.style.display = "none";
      if (drawerRepoLink) drawerRepoLink.style.display = "none";
      if (fileComplaintBtn) fileComplaintBtn.textContent = "🚨 Report Non-Compliance to Local Authorities";

      updateMetrics();
      checkFirstTimeTour();
    });
  }

  if (officerLoginForm) {
    listen(officerLoginForm, "submit", (e) => {
      e.preventDefault();
      const id = officerIdInput.value.trim() || "DOCA-LM-1092";
      const z = officerStateSelect ? officerStateSelect.value : "Central Headquarters";
      currentSession.role = "OFFICER";
      currentSession.userIdentifier = id;
      currentSession.state = z;
      roleGatewayModal.style.display = "none";

      if (userInfo) userInfo.style.display = "flex";
      if (officerName) officerName.textContent = "Inspector: " + id;
      if (repositorySection) repositorySection.style.display = "flex";
      if (drawerRepoLink) drawerRepoLink.style.display = "block";
      if (fileComplaintBtn) fileComplaintBtn.textContent = "🚨 Issue Statutory Notice";

      if (stateDropdown) {
        stateDropdown.value = z in indiaGeography ? z : "Delhi";
        populateDistricts(stateDropdown.value);
      }

      loadDatabaseInspections();
      updateMetrics();
      checkFirstTimeTour();
    });
  }

  if (logoutBtn) {
    listen(logoutBtn, "click", () => {
      roleGatewayModal.style.display = "flex";
    });
  }

  // -------------------------------------------------------------
  // 7. JURISDICTION & GPS CONTROLLER
  // -------------------------------------------------------------
  function populateGeography() {
    if (!stateDropdown) return;
    stateDropdown.innerHTML = "";
    const states = Object.keys(indiaGeography).sort();
    for (let i = 0; i < states.length; i++) {
      const st = states[i];
      const opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st;
      stateDropdown.appendChild(opt);
    }
    stateDropdown.value = "Delhi";
    populateDistricts("Delhi");
  }

  function populateDistricts(st) {
    if (!districtDropdown) return;
    districtDropdown.innerHTML = "";
    const dists = indiaGeography[st] || ["General Division"];
    for (let i = 0; i < dists.length; i++) {
      const d = dists[i];
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      districtDropdown.appendChild(opt);
    }
    currentSession.state = st;
    currentSession.district = dists[0];
  }

  if (stateDropdown) {
    listen(stateDropdown, "change", (e) => {
      const st = e.target.value;
      populateDistricts(st);
      const matched = stateLangDefaults[st] || "en";
      if (languageSelector) languageSelector.value = matched;
      updateLanguage(matched);
    });
  }

  if (districtDropdown) {
    listen(districtDropdown, "change", (e) => {
      currentSession.district = e.target.value;
    });
  }

  if (pincodeInput) {
    listen(pincodeInput, "change", (e) => {
      currentSession.pincode = e.target.value.trim();
    });
  }

  if (refreshLocationBtn) {
    listen(refreshLocationBtn, "click", () => {
      if (!navigator.geolocation) return alert("Geolocation not supported by browser.");
      if (locStatus) locStatus.textContent = "Locking GPS coordinates...";
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await request("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + pos.coords.latitude + "&lon=" + pos.coords.longitude);
            if (r.ok) {
              const d = await r.json();
              const addr = d.address || {};
              const st = addr.state;
              if (st && indiaGeography[st]) {
                stateDropdown.value = st;
                populateDistricts(st);
                if (addr.state_district && indiaGeography[st].indexOf(addr.state_district) !== -1) {
                  districtDropdown.value = addr.state_district;
                }
                if (addr.postcode) pincodeInput.value = addr.postcode;
                if (locStatus) locStatus.textContent = "Locked: " + st + " (" + (addr.postcode || '') + ")";
                const matched = stateLangDefaults[st] || "en";
                if (languageSelector) languageSelector.value = matched;
                updateLanguage(matched);
              }
            }
          } catch (e) {
            if (locStatus) locStatus.textContent = "GPS resolved. Manual select active.";
          }
        },
        () => { if (locStatus) locStatus.textContent = "Location access denied."; },
        { timeout: 5000 }
      );
    });
  }

  // -------------------------------------------------------------
  // 8. SIDE DRAWER NAVIGATION
  // -------------------------------------------------------------
  function openDrawer() {
    if (sideDrawer && drawerBackdrop) {
      sideDrawer.classList.add("open");
      drawerBackdrop.style.display = "block";
      sideDrawer.inert = false;
      hamburgerBtn?.setAttribute("aria-expanded", "true");
      drawerCloseBtn?.focus();
    }
  }

  function closeDrawer() {
    if (sideDrawer && drawerBackdrop) {
      sideDrawer.classList.remove("open");
      drawerBackdrop.style.display = "none";
      sideDrawer.inert = true;
      hamburgerBtn?.setAttribute("aria-expanded", "false");
    }
  }

  if (hamburgerBtn) listen(hamburgerBtn, "click", openDrawer);
  if (drawerCloseBtn) listen(drawerCloseBtn, "click", closeDrawer);
  if (drawerBackdrop) listen(drawerBackdrop, "click", closeDrawer);
  if (sideDrawer) {
    sideDrawer.inert = true;
    sideDrawer.querySelectorAll('a').forEach(link => listen(link, 'click', closeDrawer));
  }

  const mobileToolsBtn = document.getElementById('mobileToolsBtn');
  const nav = document.querySelector('.app-nav');
  function closeTools() {
    nav?.classList.remove('tools-open');
    mobileToolsBtn?.setAttribute('aria-expanded', 'false');
  }
  if (mobileToolsBtn) listen(mobileToolsBtn, 'click', () => {
    const open = nav.classList.toggle('tools-open');
    mobileToolsBtn.setAttribute('aria-expanded', String(open));
  });
  listen(document, 'click', event => {
    if (!nav?.contains(event.target)) closeTools();
  });
  if (viewRulesBtn) listen(viewRulesBtn, 'click', closeTools);
  if (logoutBtn) listen(logoutBtn, 'click', closeTools);
  listen(document, 'keydown', event => {
    if (event.key === 'Escape') {
      if (sideDrawer?.classList.contains('open')) { closeDrawer(); hamburgerBtn?.focus(); }
      if (nav?.classList.contains('tools-open')) { closeTools(); mobileToolsBtn?.focus(); }
    }
  });
  const dockLinks = document.querySelectorAll('.mobile-dock a');
  dockLinks.forEach(link => listen(link, 'click', () => {
    dockLinks.forEach(item => item.classList.toggle('active', item === link));
    if (aiChatWindow) aiChatWindow.style.display = 'none';
    document.getElementById('mobileAdvisorBtn')?.setAttribute('aria-expanded', 'false');
  }));

  // -------------------------------------------------------------
  // 9. DYNAMIC TRANSLATION ENGINE (UI, Rules Modal & Scan Cards)
  // -------------------------------------------------------------
  function escapeHtml(value) { return String(value).replace(/[&<>"\']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "\'":"&#39;"}[c])); }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  }

  function updateLanguage(lang) {
    activeLanguage = lang;
    const dict = i18n[lang] || i18n.en;

    setText("agencyTitleHeader", dict.agencyTitle);
    setText("viewRulesBtn", dict.viewRulesBtn);
    setText("lblTotalScanned", dict.lblTotalScanned);
    setText("lblCompliant", dict.lblCompliant);
    setText("lblViolations", dict.lblViolations);
    setText("lblUploadTitle", dict.lblUploadTitle);
    setText("lblUploadSub", dict.lblUploadSub);
    setText("lblDropText", dict.lblDropText);
    setText("lblDropHint", dict.lblDropHint);
    setText("lblPdpArea", dict.lblPdpArea);
    setText("scanButton", dict.scanBtn);
    setText("lblAuditTitle", dict.lblAuditTitle);

    if (fileComplaintBtn) {
      fileComplaintBtn.textContent = currentSession.role === "CITIZEN" ? dict.reportBtnCitizen : dict.reportBtnOfficer;
    }

    // Re-render the Rules Modal content in the selected regional language
    if (rulesListModalContent) {
      rulesListModalContent.innerHTML = "";
      const keys = Object.keys(dict.rules);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const title = dict.rules[k];
        const desc = (dict.rulesDescriptions && dict.rulesDescriptions[k]) ? dict.rulesDescriptions[k] : "Mandatory check under Legal Metrology Rules, 2011.";
        const li = document.createElement("li");
        li.innerHTML = "<strong>" + title + "</strong><p style='margin: 4px 0 10px 0; font-size: 12px; color: var(--text-main);'>" + desc + "</p>";
        rulesListModalContent.appendChild(li);
      }
    }

    if (lastScanResult) renderLiveResults(lastScanResult);
  }

  function renderLiveResults(data) {
    const dict = i18n[activeLanguage] || i18n.en;
    const status = data.compliance_status || (data.is_compliant ? "PASS" : "FAIL");

    if (complianceVerdict) {
      if (status === "PASS") {
        complianceVerdict.className = "verdict-banner compliant";
        complianceVerdict.textContent = dict.verdictPass || "✔ COMPLIANT: All declarations comply with PCR 2011 & Section 36";
      } else if (status === "REVIEW") {
        complianceVerdict.className = "verdict-banner review";
        complianceVerdict.textContent = dict.verdictReview || "⚠️ REVIEW REQUIRED: Partial or ambiguous declarations detected for manual verification";
      } else if (status === "EXEMPT") {
        complianceVerdict.className = "verdict-banner exempt";
        complianceVerdict.textContent = dict.verdictExempt || "ℹ️ EXEMPT: Statutory Exemption Applies under Legal Metrology Rules";
      } else {
        complianceVerdict.className = "verdict-banner violation";
        complianceVerdict.textContent = (dict.verdictFail || "✖ VIOLATIONS DETECTED: Non-compliant declarations found") + " (" + data.total_violations + " Violations)";
      }
    }

    // Render Regulatory Marks & Symbols
    if (detectedSymbolsBox && symbolsChipsList) {
      if (data.symbols && data.symbols.length > 0) {
        symbolsChipsList.innerHTML = "";
        for (let i = 0; i < data.symbols.length; i++) {
          const s = data.symbols[i];
          const chip = document.createElement("span");
          chip.className = "symbol-chip";
          chip.innerHTML = "<span>" + escapeHtml(s.name) + "</span>";
          symbolsChipsList.appendChild(chip);
        }
        detectedSymbolsBox.style.display = "block";
      } else {
        detectedSymbolsBox.style.display = "none";
      }
    }

    if (!rulesList) return;
    rulesList.innerHTML = "";
    const keys = Object.keys(data.rules);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const r = data.rules[k];
      const rStatus = r.status || (r.compliant ? "PASS" : "FAIL");
      const title = (dict.rules && dict.rules[r.key]) ? dict.rules[r.key] : (r.rule_ref ? r.rule_ref + ": " + r.key.toUpperCase() : r.key.toUpperCase());
      const errorMsg = r.error_code ? ((dict.errors && dict.errors[r.error_code]) ? dict.errors[r.error_code] : r.error_code) : "";
      
      const card = document.createElement("div");
      card.className = "rule-card " + rStatus.toLowerCase();
      
      const badgeClass = "badge badge-" + rStatus.toLowerCase();
      const isReview = (rStatus.toUpperCase() === "REVIEW");
      const errPrefix = isReview ? "Inspection Notice: " : "Violation: ";
      const errClass = isReview ? "rule-error review-note" : "rule-error";
      card.innerHTML = 
        "<div class='rule-top'>" +
          "<span>" + title + "<span class='rule-ref-tag'>[" + (r.rule_ref || '') + "]</span></span>" +
          "<span class='" + badgeClass + "'>" + (isReview ? "REVIEW REQUIRED" : rStatus) + "</span>" +
        "</div>" +
        "<div class='rule-detected'>" + (r.detected_value ? "Extracted: " + escapeHtml(r.detected_value) : "Not Detected") + "</div>" +
        (r.explanation ? "<div class='rule-statutory-explanation'>" + escapeHtml(r.explanation) + "</div>" : "") +
        (errorMsg ? "<div class='" + errClass + "'>" + errPrefix + errorMsg + (r.penalty_clause && !isReview ? " (" + r.penalty_clause + ")" : "") + "</div>" : "");
      if (r.ocr_evidence && r.ocr_evidence.length) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "View price OCR readings";
        details.appendChild(summary);
        r.ocr_evidence.forEach(evidence => {
          const label = document.createElement("p");
          label.textContent = "Photo " + evidence.photo_number;
          details.appendChild(label);
          (evidence.readings || []).forEach(reading => {
            const row = document.createElement("div");
            row.textContent = (reading.method || "OCR") + ": " + reading.text;
            details.appendChild(row);
          });
        });
        card.appendChild(details);
      }
      rulesList.appendChild(card);
    }
  }

  if (languageSelector) {
    listen(languageSelector, "change", (e) => updateLanguage(e.target.value));
  }

  // -------------------------------------------------------------
  // 10. CONVERSATIONAL STATUTORY AI WITH SCENARIOS & OFFICIAL CONTACTS
  // -------------------------------------------------------------
  if (aiFab && aiChatWindow) {
    listen(aiFab, "click", () => {
      aiChatWindow.style.display = (aiChatWindow.style.display === "none" || !aiChatWindow.style.display) ? "flex" : "none";
      document.getElementById('mobileAdvisorBtn')?.setAttribute('aria-expanded', String(aiChatWindow.style.display === 'flex'));
      if (aiChatWindow.style.display === 'flex') document.getElementById('chatTextInput')?.focus({preventScroll: true});
    });
  }
  const mobileAdvisorBtn = document.getElementById('mobileAdvisorBtn');
  if (mobileAdvisorBtn) listen(mobileAdvisorBtn, 'click', () => aiFab?.click());
  if (chatCloseBtn) listen(chatCloseBtn, 'click', () => mobileAdvisorBtn?.setAttribute('aria-expanded', 'false'));
  if (chatCloseBtn && aiChatWindow) {
    listen(chatCloseBtn, "click", () => aiChatWindow.style.display = "none");
  }

  function appendChat(sender, htmlText) {
    if (!chatMessages) return;
    const m = document.createElement("div");
    m.className = "chat-msg " + sender;
    if (sender === "user") m.textContent = htmlText;
    else m.innerHTML = htmlText;
    chatMessages.appendChild(m);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function handleConversationalAI() {
    const raw = chatTextInput ? chatTextInput.value.trim() : "";
    if (!raw) return;

    appendChat("user", raw);
    if (chatTextInput) chatTextInput.value = "";

    // 1. Attempt dynamic multi-turn response from FastAPI backend
    try {
      const res = await request(API_BASE + "/api/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: raw, session_id: currentSession.userIdentifier })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          appendChat("ai", data.answer);
          return;
        }
      }
    } catch (e) {
      console.warn("[AI ADVISOR] Local fallback active:", e);
    }

    appendChat("ai", "The advisor service is unavailable. Please retry when the backend is online.");
  }

  if (chatSendBtn) listen(chatSendBtn, "click", handleConversationalAI);
  if (chatTextInput) listen(chatTextInput, "keypress", (e) => {
    if (e.key === "Enter") handleConversationalAI();
  });

  // Attach click listeners to chat scenario chips
  document.querySelectorAll(".chat-chip").forEach((chip) => {
    listen(chip, "click", () => {
      const q = chip.getAttribute("data-query");
      if (chatTextInput) chatTextInput.value = q;
      handleConversationalAI();
    });
  });

  // -------------------------------------------------------------
  // 11. FILE UPLOAD & WEBCAM STREAM
  // -------------------------------------------------------------
  if (dropZone && fileInput) {
    listen(dropZone, "click", () => fileInput.click());
    listen(dropZone, 'keydown', event => {
      if (event.target === dropZone && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileInput.click(); }
    });
    listen(fileInput, "change", (e) => {
      if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
    });
    listen(dropZone, "dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--gov-blue)"; });
    listen(dropZone, "dragleave", () => { dropZone.style.borderColor = "var(--border-active)"; });
    listen(dropZone, "drop", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--border-active)";
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    });
  }

  function renderPhotoList() {
    const list = document.getElementById("photoList");
    list.replaceChildren();
    setText('photoCount', selectedFiles.length + ' / 8');
    for (const [file, url] of photoObjectUrls) {
      if (!selectedFiles.includes(file)) { URL.revokeObjectURL(url); photoObjectUrls.delete(file); }
    }
    selectedFiles.forEach((file, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn-secondary";
      button.setAttribute('aria-label', 'Remove photo ' + (index + 1) + ': ' + file.name);
      button.title = 'Remove photo ' + (index + 1) + ': ' + file.name;
      if (!photoObjectUrls.has(file)) photoObjectUrls.set(file, URL.createObjectURL(file));
      const thumbnail = document.createElement('img');
      thumbnail.className = 'photo-thumbnail'; thumbnail.alt = ''; thumbnail.src = photoObjectUrls.get(file);
      const filename = document.createElement('span');
      filename.className = 'photo-filename'; filename.textContent = 'Photo ' + (index + 1) + ': ' + file.name;
      const remove = document.createElement('span');
      remove.className = 'photo-remove'; remove.textContent = '×'; remove.setAttribute('aria-hidden', 'true');
      button.append(thumbnail, filename, remove);
      button.disabled = scanning;
      button.onclick = () => {
        selectedFiles.splice(index, 1);
        selectedFile = selectedFiles[0] || null;
        renderPhotoList();
        if (selectedFile) handleFile(selectedFile);
        else { scanButton.disabled = true; previewContainer.style.display = "none"; }
      };
      list.appendChild(button);
    });
  }

  function handleFiles(files) {
    if (scanning) return;
    const incoming = Array.from(files);
    if (selectedFiles.length + incoming.length > 8) return alert("You can add up to 8 photos per package.");
    if (incoming.some(f => !f.type.startsWith("image/") || f.size > 15*1024*1024)) return alert("Use images under 15 MB each.");
    if ([...selectedFiles, ...incoming].reduce((n,f) => n+f.size, 0) > 60*1024*1024) return alert("Keep the total under 60 MB.");
    selectedFiles.push(...incoming);
    renderPhotoList();
    if (incoming.length) handleFile(incoming[incoming.length-1]);
    fileInput.value = "";
  }

  function handleFile(f) {
    if (!f.type.startsWith("image/")) return alert("Upload a valid packaging image.");
    selectedFile = f;
    if (scanButton) scanButton.disabled = !backendOnline;
    updateStatusBar("Attached: " + f.name + " (" + (f.size / 1024).toFixed(1) + " KB)");

    const r = new FileReader();
    r.onload = (e) => {
      currentImage.src = e.target.result;
      currentImage.onload = () => {
        if (previewContainer) previewContainer.style.display = "block";
        if (canvas && ctx) {
          canvas.width = currentImage.naturalWidth;
          canvas.height = currentImage.naturalHeight;
          ctx.drawImage(currentImage, 0, 0);
        }
      };
    };
    r.readAsDataURL(f);
  }

  if (modeUploadBtn && modeCameraBtn) {
    listen(modeUploadBtn, "click", () => {
      modeUploadBtn.classList.add("active");
      modeCameraBtn.classList.remove("active");
      if (dropZone) dropZone.style.display = "block";
      if (cameraContainer) cameraContainer.style.display = "none";
      if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
      }
    });

    listen(modeCameraBtn, "click", async () => {
      modeCameraBtn.classList.add("active");
      modeUploadBtn.classList.remove("active");
      if (dropZone) dropZone.style.display = "none";
      if (cameraContainer) cameraContainer.style.display = "block";

      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } }
        });
        if (videoFeed) videoFeed.srcObject = videoStream;
      } catch (err) {
        alert("Camera unavailable. Please upload a photo file.");
        modeUploadBtn.click();
      }
    });
  }

  if (captureBtn && videoFeed) {
    listen(captureBtn, "click", () => {
      if (!videoStream || scanning) return;
      if (previewContainer) previewContainer.style.display = "block";
      canvas.width = videoFeed.videoWidth || 640;
      canvas.height = videoFeed.videoHeight || 480;
      ctx.drawImage(videoFeed, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) return;
        handleFiles([new File([blob], "camera_" + Date.now() + ".jpg", { type: "image/jpeg" })]);
        if (scanButton) scanButton.disabled = !backendOnline;
        updateStatusBar("Frame captured and ready for verification.");
      }, "image/jpeg");

      currentImage.src = canvas.toDataURL("image/jpeg");
    });
  }

  // -------------------------------------------------------------
  // 12. SCAN EXECUTION PIPELINE (Network-Safe & Multi-Archetype)
  // -------------------------------------------------------------
  if (scanButton) {
    listen(scanButton, "click", async () => {
      if (!selectedFiles.length || scanning) return;
      if (!backendOnline) return updateStatusBar("Scanner backend unavailable. Please wait for the Online indicator.");
      scanning = true;
      renderPhotoList();

      scanButton.disabled = true;
      scanButton.setAttribute('aria-busy', 'true');
      renderOCREngineChoice();
      const engineLabel = ({paddleocr: 'PaddleOCR', tesseract: 'Tesseract OCR', hybrid: 'PaddleOCR + Tesseract'})[selectedOCREngine];
      const scanStarted = performance.now();
      const showElapsed = () => updateStatusBar(engineLabel + ' is reading ' + selectedFiles.length + ' photo(s)… ' + Math.floor((performance.now() - scanStarted) / 1000) + 's');
      showElapsed();
      const scanTimer = repeat(showElapsed, 1000);

      const fd = new FormData();
      selectedFiles.forEach(file => fd.append("files", file));
      fd.append("ocr_engine", selectedOCREngine);
      fd.append("surface_area", packageAreaInput ? packageAreaInput.value : "95.0");
      fd.append("user_role", currentSession.role);
      fd.append("user_identifier", currentSession.userIdentifier);
      fd.append("state", currentSession.state);
      fd.append("district", currentSession.district);
      fd.append("pincode", currentSession.pincode);
      fd.append("category", categoryFilter ? categoryFilter.value : "FOOD");

      try {
        const res = await request(API_BASE + "/api/scan", { method: "POST", body: fd });
        if (!res.ok) {
          const failure = await res.json().catch(() => ({}));
          throw new Error(failure.error || failure.detail || "Server returned HTTP " + res.status);
        }

        const data = await res.json();
        const resultImage = new Image();
        resultImage.src = API_BASE + data.image_url;
        await resultImage.decode();
        currentImage = resultImage;
        canvas.width = resultImage.naturalWidth;
        canvas.height = resultImage.naturalHeight;
        lastScanResult = data;
        const caseId = "DoCA-LM-2026-" + String(data.inspection_id).padStart(4, "0");

        if (canvas && ctx && currentImage.src) {
          ctx.drawImage(currentImage, 0, 0);
          // Draw text detections (Green if compliant, Red if violations present)
          if (data.detections) {
            ctx.lineWidth = 3;
            for (let i = 0; i < data.detections.length; i++) {
              const d = data.detections[i];
              if (d.bbox && d.bbox.length === 4) {
                const tl = d.bbox[0];
                const br = d.bbox[2];
                ctx.strokeStyle = data.is_compliant ? "#16a34a" : "#dc2626";
                ctx.strokeRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
              }
            }
          }

          // Draw symbol detections in cyan with tags
          if (data.symbols) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#0284c7";
            ctx.fillStyle = "#0284c7";
            ctx.font = "bold 14px sans-serif";
            for (let i = 0; i < data.symbols.length; i++) {
              const s = data.symbols[i];
              if (s.bbox && s.bbox.length === 4) {
                const tl = s.bbox[0];
                const br = s.bbox[2];
                ctx.strokeRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
                ctx.fillText(s.name.split(" ")[0], tl[0], Math.max(16, tl[1] - 4));
              }
            }
          }
        }

        if (caseIdBadge) caseIdBadge.textContent = "Case: " + caseId;
        if (downloadPdfBtn) {
          downloadPdfBtn.style.display = data.report_pdf_url ? "inline-block" : "none";
          if (data.report_pdf_url) downloadPdfBtn.href = API_BASE + data.report_pdf_url;
        }
        if (fileComplaintBtn) {
          fileComplaintBtn.style.display = data.is_compliant ? "none" : "inline-block";
        }

        renderLiveResults(data);

        const histStatus = data.compliance_status || (data.is_compliant ? "PASS" : "FAIL");
        auditHistory.unshift({
          id: data.inspection_id,
          caseId: caseId,
          userRole: data.user_role,
          userIdentifier: data.user_identifier,
          time: data.timestamp,
          brand: data.brand,
          location: (data.district || currentSession.district) + ", " + (data.state || currentSession.state),
          category: data.category,
          area: packageAreaInput ? packageAreaInput.value : "95.0",
          status: histStatus,
          violations: data.is_compliant ? "None (Compliant)" : data.total_violations + " Violations",
          pdf_url: data.report_pdf_url
        });

        updateMetrics();
        renderHistoryTable();
        clearInterval(scanTimer);
        updateStatusBar('Audit complete · ' + engineLabel + ' · ' + ((performance.now() - scanStarted) / 1000).toFixed(1) + 's. Case ' + caseId + ' persisted to database.');
        if (window.matchMedia('(max-width: 700px)').matches) {
          document.getElementById('guideStepAudit')?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
          dockLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#guideStepAudit'));
        }

      } catch (e) {
        console.error("[SCAN ERROR]", e);
        updateStatusBar("Verification Failed: " + e.message + ". Active gateway: " + API_BASE);
        alert("Inspection Error: " + e.message);
      } finally {
        clearInterval(scanTimer);
        intervals.delete(scanTimer);
        scanning = false;
        scanButton.setAttribute('aria-busy', 'false');
        renderOCREngineChoice();
        renderPhotoList();
        scanButton.disabled = !selectedFiles.length || !backendOnline;
      }
    });
  }

  // -------------------------------------------------------------
  // 12B. PRESET PACKAGING DEMO LOADER (1-CLICK JURY AUDIT)
  // -------------------------------------------------------------
  const presetConfig = {
    atta_1kg_compliant: {
      image: "presets/atta_1kg.jpg",
      category: "FOOD",
      area: "140",
      filename: "atta_1kg.jpg"
    },
    biscuit_non_si_violation: {
      image: "presets/biscuit_violation.jpg",
      category: "FOOD",
      area: "85",
      filename: "biscuit_violation.jpg"
    },
    cold_drink_750ml_compliant: {
      image: "presets/drink_750ml.jpg",
      category: "DRINKS",
      area: "110",
      filename: "drink_750ml.jpg"
    },
    soap_tfm_compliant: {
      image: "presets/soap_125g.jpg",
      category: "SOAP",
      area: "60",
      filename: "soap_125g.jpg"
    },
    earbuds_origin_violation: {
      image: "presets/earbuds_violation.jpg",
      category: "ELECTRONICS",
      area: "75",
      filename: "earbuds_violation.jpg"
    }
  };

  async function loadPreset(presetId) {
    if (scanning) return;
    const cfg = presetConfig[presetId];
    if (!cfg) return;

    updateStatusBar("Loading demo packaging preset: " + presetId + "...");
    if (categoryFilter) categoryFilter.value = cfg.category;
    if (packageAreaInput) packageAreaInput.value = cfg.area;

    try {
      const resp = await request(cfg.image);
      const blob = await resp.blob();
      selectedFile = new File([blob], cfg.filename, { type: "image/jpeg" });
      selectedFiles = [selectedFile];
      renderPhotoList();

      const imgUrl = URL.createObjectURL(blob);
      currentImage.src = imgUrl;
      currentImage.onload = () => {
        if (previewContainer) previewContainer.style.display = "block";
        if (canvas && ctx) {
          canvas.width = currentImage.naturalWidth;
          canvas.height = currentImage.naturalHeight;
          ctx.drawImage(currentImage, 0, 0);
        }
        if (scanButton) {
          scanButton.disabled = !backendOnline;
          updateStatusBar("Preset loaded: " + cfg.filename + ". Analyzing...");
          scanButton.click();
        }
      };
    } catch (err) {
      console.error("[PRESET ERROR]", err);
      updateStatusBar("Preset fetch deferred. You can upload photo manually.");
    }
  }

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    listen(btn, "click", () => {
      const pid = btn.getAttribute("data-preset");
      loadPreset(pid);
    });
  });

  // -------------------------------------------------------------
  // 13. DISPATCH REPORT
  // -------------------------------------------------------------
  if (fileComplaintBtn) {
    listen(fileComplaintBtn, "click", () => {
      if (!lastScanResult) return;
      if (dispatchNoticeModal) dispatchNoticeModal.style.display = "flex";
    });
  }

  if (closeDispatchModal) {
    listen(closeDispatchModal, "click", () => {
      if (dispatchNoticeModal) dispatchNoticeModal.style.display = "none";
    });
  }

  if (dispatchForm) {
    listen(dispatchForm, "submit", async (e) => {
      e.preventDefault();
      const target = dispatchTargetSelect ? dispatchTargetSelect.value : "LOCAL_BODY";
      const contact = dispatchContactInput ? dispatchContactInput.value.trim() : "enforcement@doca.gov.in";

      const fd = new FormData();
      fd.append("case_id", "DoCA-LM-2026-" + (lastScanResult ? lastScanResult.inspection_id : "0001"));
      fd.append("sender_id", currentSession.userIdentifier);
      fd.append("recipient_type", target);
      fd.append("recipient_contact", contact);

      try {
        const res = await request(API_BASE + "/api/complaints/dispatch", { method: "POST", body: fd });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Could not prepare the draft");
        alert(resData.message + "\nDraft reference: " + resData.reference_id);
        if (dispatchNoticeModal) dispatchNoticeModal.style.display = "none";
        if (fileComplaintBtn) fileComplaintBtn.style.display = "none";
      } catch (err) {
        alert("Notice transmission failed. Check network connection to backend gateway.");
      }
    });
  }

  // -------------------------------------------------------------
  // 14. HISTORICAL REPOSITORY SYNC & EXPORTS
  // -------------------------------------------------------------
  async function loadDatabaseInspections() {
    try {
      const res = await request(API_BASE + "/api/inspections");
      if (res.ok) {
        auditHistory = await res.json();
        updateMetrics();
        renderHistoryTable();
      }
    } catch (e) {
      console.warn("[REPO] Sync deferred:", e);
    }
  }

  function updateMetrics() {
    setText("totalChecksCount", auditHistory.length.toLocaleString());
    setText("compliantCount", auditHistory.filter(i => i.status === "PASS").length.toLocaleString());
    setText("violationCount", auditHistory.filter(i => i.status === "FAIL").length.toLocaleString());
    setText("complaintsCount", currentSession.complaintsCount.toLocaleString());
  }

  function renderHistoryTable() {
    if (!historyTableBody) return;
    const query = repoSearchInput ? repoSearchInput.value.toLowerCase() : "";
    const cat = categoryFilter ? categoryFilter.value : "ALL";
    const stat = statusFilter ? statusFilter.value : "ALL";

    historyTableBody.innerHTML = "";

    const visible = auditHistory.filter(
      (item) => item.userIdentifier === currentSession.userIdentifier || currentSession.userIdentifier === "GUEST_CITIZEN"
    );

    for (let i = 0; i < visible.length; i++) {
      const item = visible[i];
      const matchQ = item.caseId.toLowerCase().indexOf(query) !== -1 || item.brand.toLowerCase().indexOf(query) !== -1 || (item.location && item.location.toLowerCase().indexOf(query) !== -1);
      const matchC = cat === "ALL" || item.category === cat;
      const matchS = stat === "ALL" || item.status === stat;

      if (matchQ && matchC && matchS) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td><strong>" + escapeHtml(item.caseId) + "</strong></td>" +
                       "<td>" + escapeHtml(item.time) + "</td>" +
                       "<td>" + escapeHtml(item.brand) + "</td>" +
                       "<td>" + escapeHtml(item.location || 'Central Node') + "</td>" +
                       "<td>" + escapeHtml(item.area || '120') + "</td>" +
                       "<td><span class='badge " + (item.status === "PASS" ? "badge-pass" : "badge-fail") + "'>" + escapeHtml(item.status) + "</span></td>" +
                       "<td>" + escapeHtml(item.violations) + "</td>" +
                       "<td>" + (item.pdf_url ? "<a href='" + escapeHtml(API_BASE + item.pdf_url) + "' target='_blank' class='btn-secondary' style='padding: 4px 8px; font-size: 11px;'>📄 PDF</a>" : "") + "</td>";
        historyTableBody.appendChild(tr);
      }
    }
  }

  if (repoSearchInput) listen(repoSearchInput, "input", renderHistoryTable);
  if (categoryFilter) listen(categoryFilter, "change", renderHistoryTable);
  if (statusFilter) listen(statusFilter, "change", renderHistoryTable);

  if (exportCsvBtn) {
    listen(exportCsvBtn, "click", () => {
      const headers = ["Case ID", "User Role", "Identifier", "Timestamp", "Brand", "Location", "Area", "Status", "Violations"];
      const visible = auditHistory.filter((i) => i.userIdentifier === currentSession.userIdentifier || currentSession.userIdentifier === "GUEST_CITIZEN");
      const rows = visible.map((h) => [h.caseId, h.userRole, h.userIdentifier, h.time, '"' + h.brand + '"', '"' + (h.location || '') + '"', h.area || '120', h.status, '"' + h.violations + '"']);
      const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const a = document.createElement("a");
      a.href = encodeURI(csv);
      a.download = "DoCA_LM_Audit_" + Date.now() + ".csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  if (exportJsonBtn) {
    listen(exportJsonBtn, "click", () => {
      const visible = auditHistory.filter((i) => i.userIdentifier === currentSession.userIdentifier || currentSession.userIdentifier === "GUEST_CITIZEN");
      const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(visible, null, 2));
      const a = document.createElement("a");
      a.href = jsonStr;
      a.download = "DoCA_LM_Audit_" + Date.now() + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  // -------------------------------------------------------------
  // 15. GUIDED TOUR
  // -------------------------------------------------------------
  const tourSteps = [
    {
      title: "Step 1: Jurisdiction & District Lock",
      desc: "Ensure your packaging inspection state and district are selected. Table II numeral minimums and grievance redressal cells bind to this territory.",
      target: "guideStepLocation"
    },
    {
      title: "Step 2: Evidence Photography Capture",
      desc: "Upload label photographs (PNG/JPG) or switch to 'Live Camera' to frame commodities directly on your physical inspection desk.",
      target: "guideStepUpload"
    },
    {
      title: "Step 3: Principal Display Panel Area",
      desc: "Enter the surface area in sq. cm. Rule 7 (Table II) automatically calculates mandatory numeral and letter height minimums based on this area.",
      target: "guideStepArea"
    },
    {
      title: "Step 4: Real-Time Audit & Legal Action",
      desc: "Click 'Run Legal Metrology Verification'. Violations are isolated on screen. Citizens can report to local authorities; Officers can issue Section 36 notices.",
      target: "guideStepAudit"
    }
  ];

  let tourIndex = 0;
  const guideOverlay = document.getElementById("guideOverlay");
  const guideTitle = document.getElementById("guideTitle");
  const guideDesc = document.getElementById("guideDesc");
  const guideStepTag = document.getElementById("guideStepTag");
  const guideNextBtn = document.getElementById("guideNextBtn");
  const guideSkipBtn = document.getElementById("guideSkipBtn");

  function startTour() {
    tourIndex = 0;
    renderTourStep();
    if (guideOverlay) guideOverlay.style.display = "flex";
  }

  function renderTourStep() {
    const s = tourSteps[tourIndex];
    if (guideStepTag) guideStepTag.textContent = "Step " + (tourIndex + 1) + " of " + tourSteps.length;
    if (guideTitle) guideTitle.textContent = s.title;
    if (guideDesc) guideDesc.textContent = s.desc;
    if (guideNextBtn) guideNextBtn.textContent = tourIndex === tourSteps.length - 1 ? "Finish Tour ✔" : "Next Step ➔";

    const el = document.getElementById(s.target);
    if (el) {
      const settings = el.closest('details');
      if (settings) settings.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (guideNextBtn) {
    listen(guideNextBtn, "click", () => {
      tourIndex++;
      if (tourIndex < tourSteps.length) {
        renderTourStep();
      } else {
        if (guideOverlay) guideOverlay.style.display = "none";
        localStorage.setItem("doca_tour_done", "true");
      }
    });
  }

  if (guideSkipBtn) {
    listen(guideSkipBtn, "click", () => {
      if (guideOverlay) guideOverlay.style.display = "none";
      localStorage.setItem("doca_tour_done", "true");
    });
  }

  function checkFirstTimeTour() {
    if (!localStorage.getItem("doca_tour_done")) {
      later(startTour, 600);
    }
  }

  // -------------------------------------------------------------
  // 16. THEME & INITIALIZATION
  // -------------------------------------------------------------
  function initTheme() {
    const s = localStorage.getItem("doca_theme") || "light";
    document.documentElement.setAttribute("data-theme", s);
    if (themeToggleBtn) themeToggleBtn.textContent = s === "light" ? "☀️ Light" : "🌙 Dark";
  }

  if (themeToggleBtn) {
    listen(themeToggleBtn, "click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "light";
      const next = cur === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("doca_theme", next);
      themeToggleBtn.textContent = next === "light" ? "☀️ Light" : "🌙 Dark";
    });
  }

  if (viewRulesBtn && rulesModal) {
    listen(viewRulesBtn, "click", () => {
      updateLanguage(activeLanguage);
      rulesModal.style.display = "flex";
    });
  }
  if (closeRulesModal && rulesModal) {
    listen(closeRulesModal, "click", () => {
      rulesModal.style.display = "none";
    });
  }

  let healthInFlight = false;
  async function checkBackendHealth() {
    if (healthInFlight || scanning || lifetime.signal.aborted) return;
    healthInFlight = true;
    const pill = document.getElementById("backendStatusPill");
    if (!backendOnline && !hostedPreview) {
      if (pill) pill.textContent = "◌ Backend: Connecting";
      updateStatusBar("Connecting to scanner. The free server may take about a minute to wake up.");
    }
    try {
      if (await resolveActiveBackend()) {
        if (lifetime.signal.aborted) return;
        if (!backendOnline) updateStatusBar("Scanner connected. Ready to scan your photos.");
        backendOnline = true;
        if (scanButton && !scanning) scanButton.disabled = !selectedFiles.length;
        if (pill) {
          pill.textContent = "● Backend: Online";
          pill.style.color = "#16a34a";
          pill.style.borderColor = "rgba(22, 163, 74, 0.3)";
          pill.style.background = "rgba(22, 163, 74, 0.12)";
        }
      } else {
        throw new Error("Backend responded with non-200");
      }
    } catch (e) {
      if (lifetime.signal.aborted) return;
      backendOnline = false;
      if (scanButton) scanButton.disabled = true;
      if (pill) {
        pill.textContent = "○ Backend: Unavailable";
        pill.style.color = "#f59e0b";
        pill.style.borderColor = "rgba(245, 158, 11, 0.3)";
        pill.style.background = "rgba(245, 158, 11, 0.12)";
      }
      if (!hostedPreview) updateStatusBar("Scanner is still starting or unavailable. Retrying automatically; your selected photos are kept.");
    } finally { healthInFlight = false; }
  }

  initTheme();
  populateGeography();
  updateLanguage("en");
  checkBackendHealth();
  repeat(() => { if (!document.hidden) checkBackendHealth(); }, 10000);
  listen(document, 'visibilitychange', () => { if (!document.hidden) checkBackendHealth(); });

  return dispose;
}
