import ScannerRuntime from '../components/ScannerRuntime';
import LanguageTools from '../components/LanguageTools';
import VoiceAssistant from '../components/VoiceAssistant';
import BarcodeIdentity from '../components/BarcodeIdentity';

function ScanIcon() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M10 3H5a2 2 0 0 0-2 2v5m19-7h5a2 2 0 0 1 2 2v5M3 22v5a2 2 0 0 0 2 2h5m12 0h5a2 2 0 0 0 2-2v-5M10 11h12M10 16h12M10 21h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

// Reuse the NyayaLens brand mark: three bars crossed by the cyan sight line.
function NyayaLensMark() {
  return <svg viewBox="0 0 30 31" fill="none" aria-hidden="true"><path d="M0 19h3v12H0zM7 4h3v27H7zM14 12h3v19h-3z" fill="currentColor" /><path d="M8 25h22" stroke="#61CFD8" strokeWidth="1" /></svg>;
}

export default function Page() {
  const apiUrl = process.env.METROLOGY_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  return <>



  <div id="guideOverlay" className="guide-overlay" style={{"display": "none"}}>
    <div className="guide-box" id="guideBox">
      <div className="guide-header">
        <span className="guide-step-tag" id="guideStepTag">Step 1 of 4</span>
        <button className="guide-close" id="guideSkipBtn" aria-label="Skip tour">&times;</button>
      </div>
      <h3 id="guideTitle">Welcome to Legal Metrology AI</h3>
      <p id="guideDesc">Verify pre-packaged commodity labels according to statutory PCR 2011 rules.</p>
      <div className="guide-actions">
        <button className="btn-guide-next" id="guideNextBtn">Next Step ➔</button>
      </div>
    </div>
  </div>


  <div className="modal-overlay" id="roleGatewayModal" style={{"display": "flex"}}>
    <canvas id="packagesCanvas" className="packages-bg-canvas"></canvas>

    <div className="gov-auth-container">
      <div className="gov-auth-pillar">
        <div className="emblem-circle">
          <div className="gov-seal-icon"><NyayaLensMark /></div>
        </div>
        <span className="auth-eyebrow">NYAYALENS / LABEL INTELLIGENCE</span>
        <h2>A little clarity.<br /><em>On every label.</em></h2>
        <p>Capture your package. Read the details. Build a clearer picture.</p>
        <span className="auth-demo-note">Demo workspace · Human review matters</span>
      </div>

      <div className="gov-auth-form-column">
        <div className="auth-welcome"><h3>Welcome to your workspace</h3><p>Choose how you’d like to explore.</p></div>
        <div className="auth-role-tabs">
          <button className="tab-btn active" id="tabCitizenBtn">Citizen</button>
          <button className="tab-btn" id="tabOfficerBtn">Officer demo</button>
        </div>

        <form id="citizenLoginForm" className="auth-form-pane">
          <div className="input-float-group">
            <input type="text" id="citizenIdentityInput" required placeholder=" " autoComplete="off" />
            <label htmlFor="citizenIdentityInput">Mobile Number or Email</label>
            <div id="citizenIdentityError" className="auth-input-error" style={{"display": "none"}}></div>
          </div>
          <div className="input-float-group">
            <input type="text" id="citizenOtpInput" inputMode="numeric" defaultValue="26034" required placeholder=" " maxLength={6} />
            <label htmlFor="citizenOtpInput">Demo code: 26034</label>
            <div id="citizenOtpError" className="auth-input-error" style={{"display": "none"}}></div>
          </div>
          <button type="submit" className="btn-gov-submit">Enter Citizen Mode</button>
        </form>

        <form id="officerLoginForm" className="auth-form-pane" style={{"display": "none"}}>
          <div className="input-float-group">
            <input type="text" id="officerIdInput" required placeholder=" " />
            <label htmlFor="officerIdInput">Officer demo username</label>
          </div>
          <div className="input-float-group">
            <input type="password" id="officerPassInput" required placeholder=" " />
            <label htmlFor="officerPassInput">Demo password</label>
          </div>
          <div className="input-float-group">
            <select id="officerStateSelect" className="gov-select-native">
              <option value="Central Headquarters">Central Headquarters - New Delhi</option>
              <option value="Maharashtra">Maharashtra State Metrology Cell</option>
              <option value="Karnataka">Karnataka Weights & Measures Wing</option>
              <option value="Andhra Pradesh">Andhra Pradesh Consumer Enforcement</option>
              <option value="Tamil Nadu">Tamil Nadu Legal Metrology Division</option>
              <option value="Gujarat">Gujarat Metrology Enforcement</option>
              <option value="West Bengal">West Bengal Legal Metrology Directorate</option>
            </select>
          </div>
          <button type="submit" className="btn-gov-submit">Enter Officer Mode</button>
        </form>
      </div>
    </div>
  </div>


  <div className="side-drawer-backdrop" id="drawerBackdrop" style={{"display": "none"}}></div>
  <aside className="side-drawer" id="sideDrawer" aria-label="Navigation">
    <div className="drawer-header">
      <div className="drawer-brand">NyayaLens / workspace</div>
      <button className="drawer-close" id="drawerCloseBtn" aria-label="Close navigation">&times;</button>
    </div>
    <div className="drawer-menu">
      <a href="#workspace" className="drawer-link active">📍 Inspection Scanner</a>
      <a href="#repositorySection" className="drawer-link" id="drawerRepoLink">📁 Case Audit Logs</a>
      <hr className="drawer-divider" />
      <span className="drawer-section-title">Backend Architecture & API Gateway</span>
      <a href="http://127.0.0.1:8000/docs" target="_blank" className="drawer-link">⚡ FastAPI Swagger UI Docs</a>
      <a href="http://127.0.0.1:8000/redoc" target="_blank" className="drawer-link">📑 ReDoc Architecture Docs</a>
      <a href="http://127.0.0.1:8000/api/inspections" target="_blank" className="drawer-link">📊 SQLite Live Inspection Logs (JSON)</a>
      <a href="http://127.0.0.1:8000/api/v1/health" target="_blank" className="drawer-link">🩺 System Diagnostics & Health</a>
      <hr className="drawer-divider" />
      <span className="drawer-section-title">Government Statutory Portals</span>
      <a href="https://consumeraffairs.gov.in/pages/legal-metrology-act" target="_blank" className="drawer-link">🏛️ DoCA Metrology Act & Rules</a>
      <a href="https://lm.doca.gov.in/" target="_blank" className="drawer-link">📜 e-Manak Verification Portal</a>
      <a href="https://consumerhelpline.gov.in/" target="_blank" className="drawer-link">📞 NCH INGRAM Helpline (1915)</a>
    </div>
  </aside>


  <header className="app-nav">
    <div className="nav-left">
      <button className="hamburger-btn" id="hamburgerBtn" title="Menu" aria-label="Open navigation" aria-controls="sideDrawer" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <div className="nav-brand">
        <div className="nav-logo"><NyayaLensMark /></div>
        <div className="brand-text">
          <span className="product-wordmark">NyayaLens</span>
          <span className="agency" lang="hi">न्याय की नज़र</span>
          <span className="sub">PCR 2011 Automated Inspection Gateway — Node ID: 26034</span>
        </div>
      </div>
    </div>

    <button type="button" id="mobileToolsBtn" className="mobile-tools-btn" aria-controls="navControls" aria-expanded="false" aria-label="Open language, appearance and account settings"><span aria-hidden="true">•••</span></button>
    <div className="nav-controls" id="navControls">
      <select id="languageSelector" aria-label="Language" className="control-select">
        <option value="en">English</option>
        <option value="te">తెలుగు (Telugu)</option>
        <option value="hi">हिन्दी (Hindi)</option>
        <option value="ta">தமிழ் (Tamil)</option>
        <option value="kn">ಕನ್ನಡ (Kannada)</option>
        <option value="ml">മലയാളം (Malayalam)</option>
        <option value="mr">मराठी (Marathi)</option>
        <option value="gu">ગુજરાતી (Gujarati)</option>
        <option value="bn">বাংলা (Bengali)</option>
        <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
        <option value="or">ଓଡ଼ିଆ (Odia)</option>
        <option value="ur">اردو (Urdu)</option>
      </select>

      <button id="themeToggleBtn" className="btn-theme">☀️ Light</button>
      <button id="viewRulesBtn" className="btn-outline">📖 PCR 2011 Rules</button>
      <a href="http://127.0.0.1:8000/docs" target="_blank" className="btn-swagger" title="FastAPI Interactive Swagger Documentation (Port 8000)">⚡ Backend (Swagger)</a>
      <span className="backend-pill" id="backendStatusPill" title="FastAPI Backend Status">○ Backend: Checking</span>

      <div id="authContainer">
        <div id="userInfo" className="user-badge" style={{"display": "none"}}>
          <span className="status-dot"></span>
          <span id="officerName">Role: Citizen</span>
          <button id="logoutBtn" className="btn-text">Switch</button>
        </div>
      </div>
    </div>
  </header>


  <section className="workspace-intro" aria-labelledby="workspaceTitle">
    <div><p className="eyebrow"><span></span> YOUR PACKAGE. IN FOCUS.</p>
      <h1 id="workspaceTitle">Know your <em>label.</em></h1>
      <p className="intro-description">A clearer read. A more informed decision.</p>
    </div>
    <div className="intro-steps" aria-label="How it works"><span><b>01</b> Capture</span><i></i><span><b>02</b> Check</span><i></i><span><b>03</b> Review</span></div>
  </section>

  <main className="dashboard-grid" id="workspace">
    <section className="panel upload-panel" id="guideStepUpload">
      <div className="panel-header-row">
        <div>
          <span className="section-kicker">01 / CAPTURE</span>
          <h2 className="panel-title" id="lblUploadTitle">Product Evidence Capture</h2>
          <p className="panel-subtitle" id="lblUploadSub">Upload packaging photo or capture via live camera.</p>
        </div>
        <div className="input-toggle">
          <button id="modeUploadBtn" className="toggle-btn active">File Upload</button>
          <button id="modeCameraBtn" className="toggle-btn">Live Camera</button>
        </div>
      </div>

      <div className="upload-zone" id="dropZone" role="button" tabIndex={0} aria-label="Add package photos" aria-describedby="lblDropHint">
        <div className="zone-icon"><ScanIcon /></div>
        <strong id="lblDropText">Add your package photos</strong>
        <span id="lblDropHint">Choose photos or drop them here · JPG, PNG, WEBP</span>
        <input type="file" id="fileInput" accept="image/*" multiple hidden />
      </div>

      <p className="photo-guidance"><span className="photo-count" id="photoCount">0 / 8</span> Add the front, back and sides of one package.</p>
      <div id="photoList" className="photo-list" aria-live="polite"></div>
      <div className="camera-zone" id="cameraContainer" style={{"display": "none"}}>
        <video id="videoFeed" autoPlay playsInline></video>
        <button id="captureBtn" className="btn-capture">📸 Snap Product Frame</button>
      </div>

      <div className="form-row ocr-engine-row">
        <div className="engine-heading"><span id="ocrEngineLabel">Choose your reader</span><small>Two engines. One clearer read.</small></div>
        <div className="input-toggle" role="group" aria-labelledby="ocrEngineLabel">
          <button type="button" id="paddleOcrBtn" data-ocr-engine="paddleocr" className="toggle-btn" aria-pressed="false">PaddleOCR</button>
          <button type="button" id="tesseractOcrBtn" data-ocr-engine="tesseract" className="toggle-btn" aria-pressed="false">Tesseract OCR</button>
          <button type="button" id="hybridOcrBtn" data-ocr-engine="hybrid" className="toggle-btn active" aria-pressed="true" aria-label="Both PaddleOCR and Tesseract">Both</button>
        </div>
      </div>

      <details className="scan-settings" id="scanSettings">
        <summary><span><strong>Scan settings</strong><small>Category, location &amp; label area</small></span><span className="details-chevron" aria-hidden="true">⌄</span></summary>
        <div className="scan-settings-content">
  <section className="filter-ribbon">
    <div className="filter-group">
      <label htmlFor="categoryFilter">Product category</label>
      <select id="categoryFilter" className="filter-select">
        <option value="FOOD">Packaged Groceries & Grains (Ravva, Atta, Rice, Pulses)</option>
        <option value="DRINKS">Beverages & Bottled Drinks (Thums Up, Coke, Juices, Water)</option>
        <option value="SOAP">Soaps & Detergent Bars (Exo, Vim, Lifebuoy, Surf)</option>
        <option value="COSMETICS">Cosmetics & Personal Care (Santoor, Creams, Lotions)</option>
        <option value="ELECTRONICS">Electronics & Appliances (Earphones, Chargers)</option>
      </select>
    </div>

    <div className="filter-group">
      <label htmlFor="statusFilter">History status</label>
      <select id="statusFilter" className="filter-select">
        <option value="ALL">All Scans</option>
        <option value="FAIL">Flagged Violations Only</option>
        <option value="PASS">Certified Compliant Only</option>
      </select>
    </div>
  </section>


  <section className="location-ribbon" id="guideStepLocation">
    <div className="loc-detect-box">
      <span className="loc-icon">📍</span>
      <span id="locStatus">Jurisdiction:</span>
    </div>
    <div className="loc-input-fields">
      <select id="stateDropdown" aria-label="State" className="loc-select"></select>
      <select id="districtDropdown" aria-label="District" className="loc-select"></select>
      <input type="text" id="pincodeInput" aria-label="Pincode" inputMode="numeric" maxLength={6} placeholder="Pincode" defaultValue="110001" />
      <button id="refreshLocationBtn" className="btn-sm-action">🛰️ GPS Auto-Detect</button>
    </div>
  </section>


      <div className="form-row" id="guideStepArea">
        <label htmlFor="packageArea" id="lblPdpArea">Principal Display Panel Area (sq. cm):</label>
        <input type="number" id="packageArea" defaultValue="95.0" step="0.5" min="1" max="5000" />
      </div>

        </div>
      </details>

      <div className="preview-wrapper" id="previewContainer" style={{"display": "none"}}>
        <canvas id="detectionCanvas"></canvas>
      </div>

      <button id="scanButton" className="btn-primary" disabled>
        Run Legal Metrology Verification
      </button>

      <div id="statusBar" className="status-bar" role="status" aria-live="polite">
        System Standby. Select packaging photo or click a demo preset.
      </div>
      <details className="demo-library"><summary>Just exploring? <strong>Try a sample <span aria-hidden="true">↗</span></strong></summary>  <section className="presets-ribbon">
    <div className="presets-label">
      <span>🎯 <strong>1-Click Demo Presets:</strong></span>
    </div>
    <div className="presets-container">
      <button className="preset-btn" data-preset="atta_1kg_compliant">
        <span className="preset-icon">🌾</span>
        <span className="preset-name">Atta 1 kg</span>
        <span className="preset-tag pass">PASS (Rule 6(11) Exempt)</span>
      </button>
      <button className="preset-btn" data-preset="biscuit_non_si_violation">
        <span className="preset-icon">🍪</span>
        <span className="preset-name">Biscuits 200 gm</span>
        <span className="preset-tag fail">FAIL (Non-SI 'gm' Unit)</span>
      </button>
      <button className="preset-btn" data-preset="cold_drink_750ml_compliant">
        <span className="preset-icon">🥤</span>
        <span className="preset-name">Cola 750 ml</span>
        <span className="preset-tag pass">PASS (USP Declared)</span>
      </button>
      <button className="preset-btn" data-preset="soap_tfm_compliant">
        <span className="preset-icon">🧼</span>
        <span className="preset-name">Soap 125 g</span>
        <span className="preset-tag pass">PASS (TFM Grade 1)</span>
      </button>
      <button className="preset-btn" data-preset="earbuds_origin_violation">
        <span className="preset-icon">🎧</span>
        <span className="preset-name">Wireless Earbuds</span>
        <span className="preset-tag fail">FAIL (Missing Origin)</span>
      </button>
    </div>
  </section>


</details>
    </section>

    <section className="panel results-panel" id="guideStepAudit">
      <div className="results-header">
        <div>
          <span className="section-kicker">02 / YOUR RESULTS</span>
          <h2 className="panel-title" id="lblAuditTitle">PCR 2011 Compliance Audit</h2>
          <div className="badge-row">
            <span id="caseIdBadge" className="case-badge">Case ID: Unassigned</span>
            <span className="evidence-pill">⚖️ Section 63 BSA 2023 / 65B IEA</span>
          </div>
        </div>
        <div className="action-buttons">
          <button id="fileComplaintBtn" className="btn-danger-sm" style={{"display": "none"}}>
            🚨 Report Non-Compliance
          </button>
          <a id="downloadPdfBtn" href="#" target="_blank" className="btn-secondary" style={{"display": "none"}}>
            📄 Download Section 65B/BSA Report PDF
          </a>
        </div>
      </div>

      <div id="complianceVerdict" className="verdict-banner">
        Your label story starts here. Add photos and run a scan to see your review.
      </div>


      <div id="detectedSymbolsBox" className="symbols-card" style={{"display": "none"}}>
        <div className="symbols-title">🛡️ Detected Regulatory Marks & Symbols:</div>
        <div className="symbols-chips" id="symbolsChipsList"></div>
      </div>

      <div className="rules-container" id="rulesList"></div>
      <BarcodeIdentity apiUrl={apiUrl} />
      <LanguageTools apiUrl={apiUrl} />
    </section>


    <section className="panel repository-panel" id="repositorySection" style={{"display": "none"}}>
      <div className="results-header">
        <div>
          <h2 className="panel-title">Inspection Audit Repository & Evidence Logs</h2>
          <p className="panel-subtitle">Search, retrieve, dispatch notices, and export historical packaged commodity scans.</p>
        </div>
        <div className="action-buttons">
          <button id="exportCsvBtn" className="btn-secondary">📥 Export CSV</button>
          <button id="exportJsonBtn" className="btn-secondary">📥 Export JSON</button>
        </div>
      </div>

      <div className="repo-search-bar">
        <input type="text" id="repoSearchInput" placeholder="Search by Case ID, Brand Name, or Location..." />
      </div>

      <div className="table-responsive">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Timestamp</th>
              <th>Commodity / Brand</th>
              <th>Location</th>
              <th>Area (sq. cm)</th>
              <th>Status</th>
              <th>Violations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="historyTableBody"></tbody>
        </table>
      </div>
    </section>
  </main>

  <details className="activity-overview"><summary>Your activity <span aria-hidden="true">⌄</span></summary>  <section className="metrics-ribbon">
    <div className="metric-card">
      <span className="metric-title" id="lblTotalScanned">Total Products Scanned</span>
      <span className="metric-val" id="totalChecksCount">0</span>
    </div>
    <div className="metric-card">
      <span className="metric-title" id="lblCompliant">Compliant Commodities</span>
      <span className="metric-val text-success" id="compliantCount">0</span>
    </div>
    <div className="metric-card">
      <span className="metric-title" id="lblViolations">Violations Detected</span>
      <span className="metric-val text-danger" id="violationCount">0</span>
    </div>
    <div className="metric-card">
      <span className="metric-title">Dispatched Notices</span>
      <span className="metric-val text-warning" id="complaintsCount">0</span>
    </div>
  </section>


</details>
  <footer className="workspace-footer">Built for clearer labels. Findings need human review.</footer>


  <div className="modal-overlay" id="dispatchNoticeModal" style={{"display": "none"}}>
    <div className="modal-box">
      <div className="modal-header">
        <h3>Prepare a Complaint Draft</h3>
        <button className="close-modal" id="closeDispatchModal" aria-label="Close complaint draft">&times;</button>
      </div>
      <form id="dispatchForm" className="modal-body">
        <p>This prepares a draft only. No email or official complaint is sent. Submit your report through <a href="https://consumerhelpline.gov.in/" target="_blank" rel="noopener">National Consumer Helpline</a>.</p>
        <label>Select Authority</label>
        <select className="control-select w-100" id="dispatchTargetSelect">
          <option value="LOCAL_BODY">District Consumer Protection Council / Local Controller</option>
          <option value="STATE_COMMISSION">State Consumer Disputes Redressal Commission</option>
          <option value="MANUFACTURER">Manufacturer Registered Grievance Cell</option>
        </select>
        <label>Authority or Manufacturer Contact Email</label>
        <input type="email" id="dispatchContactInput" defaultValue="enforcement@doca.gov.in" required />
        <button type="submit" className="btn-primary w-100 mt-3">Prepare Complaint Draft</button>
      </form>
    </div>
  </div>


  <div className="modal-overlay" id="rulesModal" style={{"display": "none"}}>
    <div className="modal-box modal-lg">
      <div className="modal-header">
        <h3 id="rulesModalHeading">Legal Metrology (Packaged Commodities) Rules, 2011 Reference</h3>
        <button className="close-modal" id="closeRulesModal" aria-label="Close rules">&times;</button>
      </div>
      <div className="modal-body modal-scroll">
        <ul className="pcr-rules-ref" id="rulesListModalContent"></ul>
      </div>
    </div>
  </div>


  <div className="ai-widget-container">
    <div className="ai-chat-window" id="aiChatWindow" style={{"display": "none"}}>
      <div className="chat-header">
        <span>NyayaLens · Your voice companion</span>
        <button className="chat-close" id="chatCloseBtn" aria-label="Close advisor">&times;</button>
      </div>
      <VoiceAssistant apiUrl={apiUrl}>
      <div className="chat-chips-bar" id="chatChipsBar">
        <button className="chat-chip" data-query="Can shopkeeper charge extra cooling charges htmlFor chilled soft drinks above MRP?">❄️ Cooling Charges</button>
        <button className="chat-chip" data-query="Is dual pricing allowed at airports or multiplexes?">✈️ Airport Pricing</button>
        <button className="chat-chip" data-query="Can a retailer paste a sticker over the printed MRP?">🏷️ Price Stickers</button>
        <button className="chat-chip" data-query="What is the Rule 6(11) Unit Sale Price exemption htmlFor 1 kg packs?">⚖️ Rule 6(11) USP</button>
        <button className="chat-chip" data-query="What are the penalties under Section 36 of Legal Metrology Act?">🚨 Section 36 Fines</button>
        <button className="chat-chip" data-query="How do I contact National Consumer Helpline (NCH 1915)?">📞 Helpline 1915</button>
      </div>
      <div className="chat-messages" id="chatMessages"></div>
      <div className="chat-input-bar">
        <input type="text" id="chatTextInput" aria-label="Message to packaging advisor" placeholder="Ask about rules, overcharging, stickers, Section 36..." />
        <button id="chatSendBtn" className="chat-btn">➤</button>
      </div>
      </VoiceAssistant>
    </div>
    <button className="ai-fab" id="aiFab">Talk to NyayaLens</button>
  </div>




<nav className="mobile-dock" aria-label="Workspace shortcuts">
    <a href="#guideStepUpload" className="dock-link active"><ScanIcon /><span>Scan</span></a>
    <a href="#guideStepAudit" className="dock-link"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Zm1 5h8m-8 4h8m-8 4h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg><span>Results</span></a>
    <button type="button" id="mobileAdvisorBtn" className="dock-link" aria-controls="aiChatWindow" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Zm3 5h8m-8 4h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg><span>Advisor</span></button>
  </nav>
<ScannerRuntime apiUrl={apiUrl} />
  </>;
}
