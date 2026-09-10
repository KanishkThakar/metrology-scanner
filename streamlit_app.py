# =============================================================================
# NATIONAL LEGAL METROLOGY AI PLATFORM (STREAMLIT CLOUD EDITION)
# Smart India Hackathon 2026 | Problem Statement #26034
# Department of Consumer Affairs | Government of India
# =============================================================================

import os
import sys
import re
import math
import uuid
import hashlib
from datetime import datetime, timezone
from io import BytesIO

import streamlit as st
import numpy as np
import cv2
from PIL import Image

# Connect backend pipeline
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from main import (
        run_compliance_pipeline,
        detect_symbols,
        generate_forensic_pdf_report,
        compute_sha256,
        get_required_font_height_mm,
        init_ocr_engine,
        ocr_engine_name
    )
    import main as backend_main
    from database import get_db, InspectionRecord, seed_database
except Exception as e:
    st.error(f"Backend pipeline initialization: {e}")

# -----------------------------------------------------------------------------
# PAGE CONFIGURATION
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="National Legal Metrology AI | DoCA SIH-26034",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# -----------------------------------------------------------------------------
# CUSTOM CSS STYLING
# -----------------------------------------------------------------------------
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        padding: 20px 24px;
        border-radius: 12px;
        color: white;
        margin-bottom: 20px;
        border-left: 6px solid #f59e0b;
        box-shadow: 0 4px 14px rgba(0,0,0,0.15);
    }
    .gov-badge {
        background: rgba(245, 158, 11, 0.2);
        color: #f59e0b;
        border: 1px solid #f59e0b;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        display: inline-block;
        margin-bottom: 8px;
    }
    .status-pass {
        background-color: #dcfce7;
        color: #166534;
        border: 1px solid #86efac;
        padding: 4px 12px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
    }
    .status-fail {
        background-color: #fee2e2;
        color: #991b1b;
        border: 1px solid #fca5a5;
        padding: 4px 12px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
    }
    .status-review {
        background-color: #fef3c7;
        color: #92400e;
        border: 1px solid #fcd34d;
        padding: 4px 12px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
    }
    .status-exempt {
        background-color: #e0f2fe;
        color: #075985;
        border: 1px solid #7dd3fc;
        padding: 4px 12px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
    }
    .evidence-tag {
        font-family: monospace;
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
    }
</style>
""", unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# INITIALIZE BACKEND SERVICES & OCR ENGINE (CACHED)
# -----------------------------------------------------------------------------
@st.cache_resource
def setup_services():
    try:
        seed_database()
    except Exception:
        pass
    init_ocr_engine()
    return True

setup_services()

# -----------------------------------------------------------------------------
# SIDEBAR CONTROLS
# -----------------------------------------------------------------------------
with st.sidebar:
    st.markdown("""
    <div style='text-align: center; margin-bottom: 15px;'>
        <div style='font-size: 40px;'>⚖️</div>
        <h3 style='margin: 0; color: #0f172a;'>Government of India</h3>
        <p style='font-size: 12px; color: #64748b; margin: 0;'>Department of Consumer Affairs</p>
    </div>
    """, unsafe_allow_html=True)
    
    st.divider()
    
    # Inspection Role
    role = st.radio("👤 Inspection Role:", ["Citizen Portal", "Legal Metrology Inspector"], index=0)
    user_role = "CITIZEN" if role == "Citizen Portal" else "OFFICER"
    
    # User Identity Validation (Strict 10-digit mobile & @gmail/@domain email)
    if user_role == "CITIZEN":
        user_identity = st.text_input("📱 Mobile Number or Email:", value="citizen@gmail.com")
        clean_dig = re.sub(r"[\s\-\+]", "", user_identity)
        is_valid_mobile = bool(re.match(r"^(?:91)?[6-9]\d{9}$", clean_dig))
        is_valid_email = bool(re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", user_identity))
        
        if not (is_valid_mobile or is_valid_email):
            st.error("❌ Enter a valid 10-digit mobile number (e.g. 9876543210) or email ending with @gmail.com, @gov.in, etc.")
        else:
            st.success("✔ Valid Identity Verified")
    else:
        user_identity = st.text_input("🛡️ Officer Parichay ID:", value="DOCA-LM-1092")
    
    st.divider()
    
    # Jurisdiction
    st.subheader("📍 Jurisdiction")
    state = st.selectbox("State / UT:", [
        "Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat",
        "Andhra Pradesh", "West Bengal", "Uttar Pradesh", "Rajasthan"
    ], index=0)
    district = st.text_input("District:", value="New Delhi" if state == "Delhi" else "Central District")
    pincode = st.text_input("Postal PIN:", value="110001")
    
    st.divider()
    
    # Commodity Archetype
    st.subheader("📦 Commodity Profile")
    category = st.selectbox("Archetype:", [
        "FOOD", "DRINKS", "SOAP", "COSMETICS", "ELECTRONICS"
    ], index=0, format_func=lambda x: {
        "FOOD": "🌾 Packaged Groceries & Food",
        "DRINKS": "🥤 Beverages & Bottled Liquids",
        "SOAP": "🧼 Soaps & Detergents",
        "COSMETICS": "💄 Cosmetics & Personal Care",
        "ELECTRONICS": "🎧 Electronics & Appliances"
    }[x])
    
    # PDP Surface Area
    surface_area = st.number_input("Principal Display Panel (cm²):", min_value=1.0, max_value=5000.0, value=95.0, step=0.5)
    req_font_mm = get_required_font_height_mm(surface_area)
    st.caption(f"Rule 7 Table II Min Numeral Height: **{req_font_mm:.1f} mm**")
    
    st.divider()
    st.caption("⚡ SIH-2026 Problem #26034 | National Node")

# -----------------------------------------------------------------------------
# MAIN HEADER BANNER
# -----------------------------------------------------------------------------
st.markdown("""
<div class='main-header'>
    <span class='gov-badge'>National Legal Metrology Enforcement Node 26034</span>
    <h1 style='margin: 0; font-size: 26px;'>Packaged Commodity Statutory Compliance Checker</h1>
    <p style='margin: 5px 0 0 0; font-size: 13px; color: #cbd5e1;'>
        Legal Metrology (Packaged Commodities) Rules, 2011 & Section 36 Enforcement Engine |
        Certified Evidence under <strong>Section 63 of Bharatiya Sakshya Adhiniyam (BSA), 2023</strong>
    </p>
</div>
""", unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# MAIN TABS
# -----------------------------------------------------------------------------
tab_scan, tab_repo, tab_advisor, tab_rules = st.tabs([
    "📷 Packaging Evidence Scanner",
    "📁 Audit Case Logs (SQLite)",
    "🤖 Metrology AI Legal Advisor",
    "📖 PCR 2011 Statutory Rules Reference"
])

# -----------------------------------------------------------------------------
# TAB 1: EVIDENCE SCANNER
# -----------------------------------------------------------------------------
with tab_scan:
    st.markdown("### 1. Capture Product Evidence")
    
    input_method = st.radio("Evidence Capture Method:", ["Upload Packaging Image", "Live Camera Snap", "1-Click Demo Presets"], horizontal=True)
    
    selected_img = None
    demo_image_name = ""
    
    if input_method == "Upload Packaging Image":
        uploaded_file = st.file_uploader("Choose an image (PNG, JPG, JPEG, WEBP)", type=["png", "jpg", "jpeg", "webp"])
        if uploaded_file:
            selected_img = Image.open(uploaded_file)
            
    elif input_method == "Live Camera Snap":
        cam_file = st.camera_input("Capture product packaging from live camera")
        if cam_file:
            selected_img = Image.open(cam_file)
            
    else: # 1-Click Demo Presets
        st.markdown("**Select a Verified Pre-Packaged Commodity Sample:**")
        col_p1, col_p2, col_p3 = st.columns(3)
        with col_p1:
            if st.button("🍜 Sunfeast YiPPee Noodles", use_container_width=True):
                demo_image_name = "media_1788713609195.jpg"
            if st.button("🌾 Atta 1 kg (Exempt Pack)", use_container_width=True):
                demo_image_name = "atta_1kg.jpg"
        with col_p2:
            if st.button("🍪 Biscuits 200 gm (Non-SI Unit)", use_container_width=True):
                demo_image_name = "biscuit_violation.jpg"
            if st.button("🥤 Cola 750 ml (USP Verified)", use_container_width=True):
                demo_image_name = "drink_750ml.jpg"
        with col_p3:
            if st.button("🧼 Soap 125 g (TFM Grade 1)", use_container_width=True):
                demo_image_name = "soap_125g.jpg"
            if st.button("🎧 Wireless Earbuds (Origin)", use_container_width=True):
                demo_image_name = "earbuds_violation.jpg"
                
        if demo_image_name:
            sample_candidates = [
                os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets", demo_image_name),
                os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "presets", demo_image_name)
            ]
            for p in sample_candidates:
                if os.path.exists(p):
                    selected_img = Image.open(p)
                    st.success(f"Loaded Preset: {demo_image_name}")
                    break

    if selected_img is not None:
        col_img, col_act = st.columns([1, 1])
        with col_img:
            st.image(selected_img, caption="Evidence Frame Payload", use_container_width=True)
            
        with col_act:
            st.info(f"""
            **Audit Parameters:**
            - **User:** `{user_identity}` ({user_role})
            - **Jurisdiction:** {district}, {state} (PIN: {pincode})
            - **Archetype:** {category}
            - **PDP Surface Area:** {surface_area:.1f} cm² (Min Numeral: {req_font_mm:.1f} mm)
            """)
            run_audit = st.button("⚖️ Run Legal Metrology Statutory Verification", type="primary", use_container_width=True)
            
        if run_audit:
            with st.spinner("Executing Forensic Pipeline: Tesseract OCR & Rule Validation..."):
                # Convert PIL to OpenCV BGR
                cv_img = cv2.cvtColor(np.array(selected_img), cv2.COLOR_RGB2BGR)
                h, w = cv_img.shape[:2]
                orig_w, orig_h = w, h
                if max(h, w) > 2400:
                    scale = 2400.0 / float(max(h, w))
                    cv_img = cv2.resize(cv_img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

                # Compute SHA-256 evidence hash
                img_bytes = cv2.imencode(".jpg", cv_img)[1].tobytes()
                evidence_hash = compute_sha256(img_bytes)

                # Shared Tesseract OCR pipeline.
                raw_lines, ocr_data = backend_main.extract_text(cv_img)
                if not raw_lines:
                    raise ValueError("No readable text found. Upload a sharper, well-lit label image.")
                for item in ocr_data:
                    item["bbox"] = [[round(x * orig_w / cv_img.shape[1]), round(y * orig_h / cv_img.shape[0])] for x, y in item["bbox"]]

                # Symbol Detection
                detected_symbols = detect_symbols(cv_img, " ".join(raw_lines))

                # Universal Rule Compliance Pipeline
                audit_res = run_compliance_pipeline(
                    raw_lines=raw_lines,
                    ocr_data=ocr_data,
                    area=float(surface_area),
                    category=str(category),
                    orig_w=orig_w,
                    orig_h=orig_h,
                    detected_symbols=detected_symbols
                )

                # Save record to SQLite
                db_id = int(uuid.uuid4().int % 100000)
                try:
                    db_gen = get_db()
                    db = next(db_gen)
                    rec = InspectionRecord(
                        case_id=f"DoCA-LM-2026-{db_id:04d}",
                        user_role=user_role,
                        user_identifier=user_identity,
                        state=state,
                        district=district,
                        pincode=pincode,
                        commodity_category=category,
                        brand_name=str(audit_res["rules"]["manufacturer"]["detected_value"] or "Packaged Commodity")[:90],
                        image_filename=f"{db_id}.jpg",
                        package_area_sq_cm=float(surface_area),
                        is_compliant=bool(audit_res["is_compliant"]),
                        compliance_status=str(audit_res["compliance_status"]),
                        total_violations=int(audit_res["total_violations"]),
                        extracted_text=" ".join(raw_lines),
                        rule_verifications=audit_res["rules"],
                        detected_symbols=detected_symbols,
                        evidence_sha256=evidence_hash
                    )
                    db.add(rec)
                    db.commit()
                    db.refresh(rec)
                    db_id = rec.id
                except Exception as dbe:
                    pass

                # Generate Section 63 BSA 2023 Forensic PDF
                os.makedirs("reports", exist_ok=True)
                pdf_path = os.path.join("reports", f"Audit_Report_{db_id}.pdf")
                tmp_img_path = os.path.join("reports", f"tmp_{db_id}.jpg")
                cv2.imwrite(tmp_img_path, cv_img)
                try:
                    generate_forensic_pdf_report(
                        db_id,
                        tmp_img_path,
                        audit_res,
                        pdf_path,
                        user_identity,
                        state,
                        district,
                        evidence_hash
                    )
                except Exception as pe:
                    pass

                # Store in session state
                st.session_state["last_audit"] = {
                    "db_id": db_id,
                    "case_id": f"DoCA-LM-2026-{db_id:04d}",
                    "audit_res": audit_res,
                    "detected_symbols": detected_symbols,
                    "evidence_hash": evidence_hash,
                    "pdf_path": pdf_path,
                    "raw_lines": raw_lines,
                    "ocr_data": ocr_data,
                    "annotated_img": cv_img
                }

    # Display Audit Results if available
    if "last_audit" in st.session_state:
        st.divider()
        audit = st.session_state["last_audit"]
        res = audit["audit_res"]
        status = res["compliance_status"]
        violations = res["total_violations"]

        # Banner
        if status == "PASS":
            st.markdown(f"""
            <div style='background: #dcfce7; border: 2px solid #22c55e; padding: 16px 20px; border-radius: 10px; color: #14532d;'>
                <h2 style='margin: 0; font-size: 22px;'>✔ STATUTORY AUDIT: FULLY COMPLIANT (0 VIOLATIONS)</h2>
                <p style='margin: 4px 0 0 0;'>Case ID: <strong>{audit["case_id"]}</strong> | Certified under Section 63 Bharatiya Sakshya Adhiniyam, 2023</p>
            </div>
            """, unsafe_allow_html=True)
        elif status == "REVIEW":
            st.markdown(f"""
            <div style='background: #fef3c7; border: 2px solid #f59e0b; padding: 16px 20px; border-radius: 10px; color: #78350f;'>
                <h2 style='margin: 0; font-size: 22px;'>⚠️ INSPECTION NOTICE: PHYSICAL REVIEW RECOMMENDED</h2>
                <p style='margin: 4px 0 0 0;'>Case ID: <strong>{audit["case_id"]}</strong> | Optical tolerance band trigger</p>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div style='background: #fee2e2; border: 2px solid #ef4444; padding: 16px 20px; border-radius: 10px; color: #7f1d1d;'>
                <h2 style='margin: 0; font-size: 22px;'>✖ NON-COMPLIANCE DETECTED ({violations} STATUTORY VIOLATIONS)</h2>
                <p style='margin: 4px 0 0 0;'>Case ID: <strong>{audit["case_id"]}</strong> | Violates Legal Metrology Act, 2009 (Section 36 Fines)</p>
            </div>
            """, unsafe_allow_html=True)

        st.markdown(f'<p style="margin-top: 10px;"><strong>Digital SHA-256 Digest:</strong> <span class="evidence-tag">{audit["evidence_hash"]}</span></p>', unsafe_allow_html=True)

        # Regulatory marks
        if audit["detected_symbols"]:
            st.markdown("**🛡️ Detected Statutory Regulatory Marks & Symbols:**")
            chips_html = " ".join([f'<span class="status-pass">🛡️ {s["name"]}</span>' for s in audit["detected_symbols"]])
            st.markdown(chips_html, unsafe_allow_html=True)
            st.write("")

        # 2 Column View: Bounding boxes on Image + Detailed Rules
        col_res_img, col_res_rules = st.columns([1, 1])

        with col_res_img:
            st.markdown("#### Optical Verification Canvas")
            # Draw bounding boxes
            canvas_img = audit["annotated_img"].copy()
            for item in audit["ocr_data"]:
                bbox = item["bbox"]
                pts = np.array(bbox, np.int32).reshape((-1, 1, 2))
                cv2.polylines(canvas_img, [pts], isClosed=True, color=(0, 200, 50), thickness=2)
            for s in audit["detected_symbols"]:
                if "bbox" in s:
                    s_pts = np.array(s["bbox"], np.int32).reshape((-1, 1, 2))
                    cv2.polylines(canvas_img, [s_pts], isClosed=True, color=(255, 100, 0), thickness=3)

            st.image(cv2.cvtColor(canvas_img, cv2.COLOR_BGR2RGB), use_container_width=True)

            # Download Section 63 BSA Report PDF
            if os.path.exists(audit["pdf_path"]):
                with open(audit["pdf_path"], "rb") as pdf_file:
                    st.download_button(
                        label="📄 Download Section 63 BSA 2023 Forensic PDF Dossier",
                        data=pdf_file.read(),
                        file_name=f"{audit['case_id']}_Legal_Dossier.pdf",
                        mime="application/pdf",
                        use_container_width=True
                    )

        with col_res_rules:
            st.markdown("#### PCR 2011 Statutory Rule Verifications")
            for k, v in res["rules"].items():
                st_badge = v["status"]
                badge_class = "status-pass" if st_badge == "PASS" else ("status-exempt" if st_badge == "EXEMPT" else ("status-review" if st_badge == "REVIEW" else "status-fail"))
                
                with st.expander(f"{v.get('rule_ref', k)} — {k.upper()}", expanded=(st_badge == "FAIL")):
                    st.markdown(f'<span class="{badge_class}">[{st_badge}]</span> &nbsp; <strong>Value:</strong> `{v.get("detected_value") or "Not Declared"}`', unsafe_allow_html=True)
                    st.write(f"**Statutory Notice:** {v.get('explanation')}")
                    if v.get("error_code"):
                        st.markdown(f"🚨 **Violation Code:** `{v.get('error_code')}`")
                    if v.get("statutory_ref"):
                        st.caption(f"⚖️ {v.get('statutory_ref')}")
                    if v.get("penalty_clause") and st_badge == "FAIL":
                        st.caption(f"⚠️ **Penal Clause:** {v.get('penalty_clause')}")

# -----------------------------------------------------------------------------
# TAB 2: AUDIT LOGS (SQLITE)
# -----------------------------------------------------------------------------
with tab_repo:
    st.markdown("### 📁 Inspection Audit Case Repository")
    st.caption("Historical packaged commodity inspections stored persistently in SQLite database (WAL mode).")
    
    try:
        db_gen = get_db()
        db = next(db_gen)
        records = db.query(InspectionRecord).order_by(InspectionRecord.timestamp.desc()).all()
        
        if records:
            data = [{
                "Case ID": r.case_id or f"DoCA-LM-2026-{r.id:04d}",
                "Timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M UTC"),
                "Brand / Manufacturer": r.brand_name,
                "Category": r.commodity_category,
                "Location": f"{r.district}, {r.state}",
                "Status": r.compliance_status or ("PASS" if r.is_compliant else "FAIL"),
                "Violations": r.total_violations,
                "Evidence SHA-256": r.evidence_sha256[:16] + "..."
            } for r in records]
            
            st.dataframe(data, use_container_width=True)
        else:
            st.info("No audit cases logged yet. Run an inspection scan in Tab 1.")
    except Exception as dbe:
        st.warning(f"Database query notice: {dbe}")

# -----------------------------------------------------------------------------
# TAB 3: LEGAL ADVISOR CHATBOT
# -----------------------------------------------------------------------------
with tab_advisor:
    st.markdown("### 🤖 Conversational Legal Metrology AI Advisor")
    st.caption("Ask questions regarding overcharging, price stickers, Section 36 penalties, and PCR 2011 statutory provisions.")
    
    faq_queries = [
        "Can a shopkeeper charge cooling charges above MRP?",
        "Are retailers allowed to paste stickers over printed MRP?",
        "What are the penalties under Section 36 of Legal Metrology Act?",
        "What is the Rule 6(11) Unit Sale Price exemption for 1 kg packs?",
        "How does Section 63 BSA 2023 validate electronic evidence?"
    ]
    
    selected_faq = st.selectbox("💡 Common Legal Metrology Queries:", ["-- Select a statutory query --"] + faq_queries)
    user_q = st.text_input("Or ask your own legal metrology question:", value=selected_faq if selected_faq != "-- Select a statutory query --" else "")
    
    if st.button("Ask Metrology AI", type="secondary") and user_q:
        q_low = user_q.lower()
        if "cooling" in q_low or "chilled" in q_low or "refrigerator" in q_low:
            ans = """**Statutory Position on Cooling Charges:**  
No retailer or shopkeeper can legally charge even one paisa above the Maximum Retail Price (MRP) under the pretext of cooling or refrigeration charges.  
Under **Rule 2(m) and Rule 6(1)(e)** of the Legal Metrology (Packaged Commodities) Rules, 2011, the MRP is inclusive of all taxes, handling, and overheads. Charging extra is a punishable offense under **Section 36(1) of the Legal Metrology Act, 2009** (fine up to ₹25,000 for the first offense). You can lodge an immediate complaint on the **National Consumer Helpline (1915)**."""
        elif "sticker" in q_low or "pasted" in q_low:
            ans = """**Statutory Position on Price Stickers:**  
Pasting stickers to inflate the printed MRP is strictly illegal under **Rule 6(1)(e) Proviso** of PCR 2011. A retailer may only paste a sticker if authorized by the manufacturer to *decrease* the price during promotions or tax reductions (GST cuts), but never to increase it. Tampering with or altering the MRP is punishable under **Section 36(3)** with fines up to ₹25,000 or imprisonment for repeat offenses."""
        elif "penalty" in q_low or "36" in q_low or "fine" in q_low:
            ans = """**Penalties under Section 36, Legal Metrology Act, 2009:**  
- **First Offense:** Fine up to **₹ 25,000**.  
- **Second Offense:** Fine up to **₹ 50,000**.  
- **Subsequent Offenses:** Fine of **₹ 50,000 to ₹ 1,00,000** OR **imprisonment up to 1 year**, or both.  
Offenses can also be compounded under Section 48 by the Legal Metrology Controller."""
        elif "6(11)" in q_low or "usp" in q_low or "1 kg" in q_low or "unit sale price" in q_low:
            ans = """**Rule 6(11) Unit Sale Price (USP) Mandate:**  
Every retail package must bear the Unit Sale Price in terms of:  
- **Per gram (₹/g) or per millilitre (₹/ml)** if net quantity is < 1 kg or < 1 L.  
- **Per kilogram (₹/kg) or per litre (₹/L)** if net quantity is > 1 kg or > 1 L.  
**Second Proviso Exemption:** Packages containing exactly **1 kg or 1 L** (or net weight <= 10 g / 10 ml under Rule 26) are exempt from declaring separate USP because the retail MRP already represents the unit price."""
        elif "bsa" in q_low or "63" in q_low or "evidence" in q_low:
            ans = """**Section 63 of Bharatiya Sakshya Adhiniyam (BSA), 2023:**  
The Bharatiya Sakshya Adhiniyam (BSA) 2023 has superseded the Indian Evidence Act, 1872. **Section 63 of BSA, 2023** governs the admissibility of electronic records. Every electronic report generated by this platform calculates a cryptographic SHA-256 checksum and forensic metadata certificate, ensuring total legal admissibility in consumer forums and criminal courts."""
        else:
            ans = f"""**Legal Metrology Department Guidance:**  
Under the Legal Metrology (Packaged Commodities) Rules, 2011, all retail pre-packaged goods sold in India must display:  
1. Name and address of manufacturer/packer  
2. Standard metric net quantity (SI units only: g, kg, ml, l)  
3. Month and year of manufacture or packing  
4. Maximum Retail Price (MRP) in Indian Rupees inclusive of all taxes  
5. Consumer grievance redressal contact (toll-free / email)  
6. Unit Sale Price (USP) under Rule 6(11)  
Consumers can report violations directly via the National Consumer Helpline at **1915** or **consumerhelpline.gov.in**."""
            
        st.markdown(ans)

# -----------------------------------------------------------------------------
# TAB 4: STATUTORY RULES REFERENCE
# -----------------------------------------------------------------------------
with tab_rules:
    st.markdown("### 📖 Legal Metrology (Packaged Commodities) Rules, 2011 — Reference")
    
    st.markdown("""
    | Statutory Rule | Mandatory Declaration | Standard Enforced | Section 36 Penalty |
    | :--- | :--- | :--- | :--- |
    | **Rule 6(1)(a)** | Manufacturer / Packer Name & Address | Full geographical address with postal PIN code | Fine up to ₹25,000 |
    | **Rule 6(1)(c)** | Net Quantity & SI Units | Standard metric units only (`g`, `kg`, `ml`, `l`). Non-standard units (`gm`, `ltr`) prohibited | Fine up to ₹25,000 |
    | **Rule 6(1)(d)** | Month & Year of Mfg / Packing | Format MM/YYYY, Best Before, or compact alphanumeric dates (e.g. `04NOV25/01AUG26`) | Fine up to ₹25,000 |
    | **Rule 6(1)(e)** | Maximum Retail Price (MRP) | Declared in Indian Rupees with statutory phrase `inclusive of all taxes` | Fine up to ₹25,000 |
    | **Rule 6(1)(n)** | Consumer Care Grievance Redressal | Dedicated helpline, email, or statutory Digital QR portal (GSR 779(E)) | Fine up to ₹25,000 |
    | **Rule 6(11)** | Unit Sale Price (USP) | Per gram or per ml for <1kg/<1L; per kg or per L for >1kg/>1L | Fine up to ₹25,000 |
    | **Rule 7, Table II** | Minimum Numeral Height | Proportional to Principal Display Panel area (e.g. >=1.5 mm for <=100 cm²) | Fine up to ₹25,000 |
    | **Rule 6(1)(m)** | Country of Origin | Strictly mandatory on imported and electronic goods | Fine up to ₹25,000 |
    """)

