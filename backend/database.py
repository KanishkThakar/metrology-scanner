from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import create_engine, event, Column, Integer, String, Float, DateTime, JSON, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker

import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./inspections.db")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False, "timeout": 20},
        pool_pre_ping=True
    )
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()
else:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class InspectionRecord(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String, index=True, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user_role = Column(String, default="CITIZEN", index=True)
    user_identifier = Column(String, default="GUEST_CITIZEN", index=True)
    state = Column(String, default="National Jurisdiction")
    district = Column(String, default="General Division")
    pincode = Column(String, default="110001")
    commodity_category = Column(String, default="FOOD")
    brand_name = Column(String, default="Packaged Commodity")
    image_filename = Column(String, nullable=False)
    package_area_sq_cm = Column(Float, default=100.0)
    is_compliant = Column(Boolean, default=False)
    compliance_status = Column(String, default="FAIL")  # PASS, FAIL, REVIEW, EXEMPT
    total_violations = Column(Integer, default=0)
    extracted_text = Column(Text, default="")
    rule_verifications = Column(JSON, default=dict)
    detected_symbols = Column(JSON, default=list)
    evidence_sha256 = Column(String, nullable=True)
    pdf_report_path = Column(String, nullable=True)


class ComplianceRule(Base):
    __tablename__ = "compliance_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_key = Column(String, unique=True, index=True, nullable=False)
    rule_reference = Column(String, nullable=False)  # e.g. "Rule 6(1)(e)"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    is_mandatory = Column(Boolean, default=True)
    category_applicability = Column(String, default="ALL")  # ALL, FOOD, DRINKS, SOAP, COSMETICS, ELECTRONICS
    default_error_code = Column(String, nullable=False)
    penalty_reference = Column(String, default="Section 36 of Legal Metrology Act, 2009 (Fine up to ₹25,000)")


class FontHeightThreshold(Base):
    __tablename__ = "compliance_thresholds"

    id = Column(Integer, primary_key=True, index=True)
    min_area_sq_cm = Column(Float, nullable=False)
    max_area_sq_cm = Column(Float, nullable=False)
    min_font_height_mm = Column(Float, nullable=False)
    rule_reference = Column(String, default="Rule 7, Table II")


Base.metadata.create_all(bind=engine)

def seed_database():
    """Seed statutory PCR 2011 rules and Table II font thresholds if not already populated."""
    db = SessionLocal()
    try:
        if db.query(ComplianceRule).count() == 0:
            statutory_rules = [
                ComplianceRule(
                    rule_key="mrp",
                    rule_reference="Rule 6(1)(e)",
                    title="Maximum Retail Price (MRP)",
                    description="MRP must be declared in Indian Rupees (₹) with the mandatory statutory phrase 'inclusive of all taxes'. Dual pricing or charging higher than MRP is an offense under Section 36(3).",
                    is_mandatory=True,
                    category_applicability="ALL",
                    default_error_code="MRP_NO_TAX_DECLARATION",
                    penalty_reference="Section 36(3), Legal Metrology Act, 2009 (Up to ₹25,000 for 1st offense, ₹50,000 for 2nd offense)"
                ),
                ComplianceRule(
                    rule_key="net_qty",
                    rule_reference="Rule 6(1)(c)",
                    title="Net Quantity & Standard Metric Units",
                    description="Weight or measure must be declared strictly in standard SI units (g, kg, ml, l). Non-standard symbols like 'gm' or 'ltr' are illegal under Section 11 of the Act.",
                    is_mandatory=True,
                    category_applicability="ALL",
                    default_error_code="NET_QTY_NON_STANDARD_UNIT",
                    penalty_reference="Section 29, Legal Metrology Act, 2009 (Penalty for non-standard units)"
                ),
                ComplianceRule(
                    rule_key="mfg_date",
                    rule_reference="Rule 6(1)(d)",
                    title="Month & Year of Manufacture/Packing",
                    description="Month and year of manufacture, packing, or import must be clearly printed on the label (e.g. MM/YYYY or Best Before date).",
                    is_mandatory=True,
                    category_applicability="ALL",
                    default_error_code="MFG_DATE_MISSING",
                    penalty_reference="Section 36(1), Legal Metrology Act, 2009"
                ),
                ComplianceRule(
                    rule_key="manufacturer",
                    rule_reference="Rule 6(1)(a)",
                    title="Manufacturer / Packer / Importer Identity",
                    description="Name of the manufacturer, packer, or importer must be clearly declared on the Principal Display Panel.",
                    is_mandatory=True,
                    category_applicability="ALL",
                    default_error_code="MANUFACTURER_MISSING",
                    penalty_reference="Section 36(1), Legal Metrology Act, 2009"
                ),
                ComplianceRule(
                    rule_key="address",
                    rule_reference="Rule 6(1)(a)",
                    title="Complete Geographical Address",
                    description="Complete geographical address with city, state, and pincode of the manufacturer, packer, or importer must be provided.",
                    is_mandatory=True,
                    category_applicability="ALL",
                    default_error_code="MANUFACTURER_ADDRESS_MISSING",
                    penalty_reference="Section 36(1), Legal Metrology Act, 2009"
                ),
                ComplianceRule(
                    rule_key="consumer_care",
                    rule_reference="Rule 6(1)(n)",
                    title="Consumer Care Redressal Details",
                    description="Contact details of the consumer grievance redressal cell (telephone/toll-free number, email address, or designated grievance executive) must be printed.",
                    is_mandatory=True,
                    category_applicability="ALL",
                    default_error_code="CONSUMER_CARE_MISSING",
                    penalty_reference="Section 36(1), Legal Metrology Act, 2009"
                ),
                ComplianceRule(
                    rule_key="usp",
                    rule_reference="Rule 6(11)",
                    title="Unit Sale Price (USP) Declaration",
                    description="Unit Sale Price (in ₹/g, ₹/ml for <1kg/<1L; or ₹/kg, ₹/L for >1kg/>1L) must be printed on packages. Packages of exactly 1 kg, 1 L, or 1 unit are exempt under the Second Proviso to Rule 6(11).",
                    is_mandatory=False,
                    category_applicability="ALL",
                    default_error_code="USP_NOT_DECLARED",
                    penalty_reference="Section 36(1), Legal Metrology Act, 2009"
                ),
                ComplianceRule(
                    rule_key="country_of_origin",
                    rule_reference="Rule 6(1)(m)",
                    title="Country of Origin Declaration",
                    description="Mandatory declaration of country of origin or manufacture for all imported commodities and electronic/electrical appliances.",
                    is_mandatory=False,
                    category_applicability="ELECTRONICS",
                    default_error_code="COUNTRY_OF_ORIGIN_MISSING",
                    penalty_reference="Section 36(1), Legal Metrology Act, 2009"
                ),
                ComplianceRule(
                    rule_key="font_compliance",
                    rule_reference="Rule 7, Table II",
                    title="Minimum Height of Numerals and Letters",
                    description="Minimum height of numerals and letters must strictly conform to Table II based on the Principal Display Panel surface area.",
                    is_mandatory=True,
                    category_applicability="ALL",
                    default_error_code="FONT_HEIGHT_SUB_STATUTORY",
                    penalty_reference="Section 36(1), Legal Metrology Act, 2009"
                ),
                ComplianceRule(
                    rule_key="category_statutory",
                    rule_reference="Category Statutory Mandates",
                    title="Commodity Category Statutory Mandate",
                    description="Category-specific requirements: FSSAI License & Veg/Non-Veg symbol for Foods/Drinks; Cosmetic Manufacturing License (M-Lic) & TFM for Soaps/Cosmetics; BIS/ISI mark for Electronics.",
                    is_mandatory=True,
                    category_applicability="ALL",
                    default_error_code="CATEGORY_MANDATE_MISSING",
                    penalty_reference="FSSAI Act 2006 / Drugs and Cosmetics Act 1940 / BIS Act 2016"
                )
            ]
            db.add_all(statutory_rules)
            db.commit()

        if db.query(FontHeightThreshold).count() == 0:
            thresholds = [
                FontHeightThreshold(min_area_sq_cm=0.0, max_area_sq_cm=50.0, min_font_height_mm=1.0),
                FontHeightThreshold(min_area_sq_cm=50.0, max_area_sq_cm=100.0, min_font_height_mm=1.5),
                FontHeightThreshold(min_area_sq_cm=100.0, max_area_sq_cm=500.0, min_font_height_mm=2.5),
                FontHeightThreshold(min_area_sq_cm=500.0, max_area_sq_cm=2500.0, min_font_height_mm=4.0),
                FontHeightThreshold(min_area_sq_cm=2500.0, max_area_sq_cm=99999.0, min_font_height_mm=6.0),
            ]
            db.add_all(thresholds)
            db.commit()
    except Exception as e:
        print("[DB SEED ERROR]:", e)
        db.rollback()
    finally:
        db.close()

seed_database()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()