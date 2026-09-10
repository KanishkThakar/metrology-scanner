import os
from PIL import Image, ImageDraw, ImageFont

def get_font(size, bold=False):
    font_paths = [
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\calibrib.ttf" if bold else "C:\\Windows\\Fonts\\calibri.ttf",
        "C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf",
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_veg_symbol(draw, x, y, size=32):
    # Statutory Green square with filled circle inside
    draw.rectangle([x, y, x + size, y + size], outline=(0, 128, 0), width=3)
    pad = size // 4
    draw.ellipse([x + pad, y + pad, x + size - pad, y + size - pad], fill=(0, 128, 0))

def draw_nonveg_symbol(draw, x, y, size=32):
    # Statutory Brown square with filled triangle inside
    draw.rectangle([x, y, x + size, y + size], outline=(139, 69, 19), width=3)
    pad = size // 5
    draw.polygon([
        (x + size // 2, y + pad),
        (x + pad, y + size - pad),
        (x + size - pad, y + size - pad)
    ], fill=(139, 69, 19))

def create_all_presets():
    out_dir = os.path.join(os.path.dirname(__file__), "presets")
    os.makedirs(out_dir, exist_ok=True)

    font_title = get_font(28, bold=True)
    font_brand = get_font(30, bold=True)
    font_body = get_font(24, bold=False)
    font_body_bold = get_font(24, bold=True)
    font_small = get_font(20, bold=False)

    # -------------------------------------------------------------
    # 1. ATTA 1KG (Compliant - Rule 6(11) Proviso 2 Exempt from USP)
    # -------------------------------------------------------------
    img = Image.new("RGB", (900, 750), color=(255, 253, 248))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 900, 70], fill=(220, 53, 69))
    draw.text((25, 20), "PACKAGED COMMODITY STATUTORY DECLARATION", fill=(255, 255, 255), font=font_title)
    
    draw.text((30, 95), "AASHIRVAAD SHUDDH CHAKKI ATTA", fill=(180, 40, 20), font=font_brand)
    draw.line([(30, 135), (870, 135)], fill=(200, 200, 200), width=2)
    
    # Use "1.0 kg" with bold font and spacing so OCR never misses the numeral
    draw.text((30, 155), "Net Quantity: 1.0 kg", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 205), "MRP: Rs. 55.00 (Inclusive of all taxes)", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 255), "Date of Packaging: 08/2026", fill=(40, 40, 40), font=font_body)
    draw.text((30, 300), "Best Before: 6 months from packaging", fill=(40, 40, 40), font=font_body)
    draw.text((30, 345), "Manufactured & Packed by: ITC Limited", fill=(40, 40, 40), font=font_body_bold)
    draw.text((30, 390), "Address: 37, J.L. Nehru Road, Kolkata, West Bengal - 700071", fill=(60, 60, 60), font=font_small)
    draw.text((30, 435), "FSSAI License No: 10012031000085", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 480), "Consumer Care: ITC Care Cell, Toll Free: 1800-425-4444", fill=(60, 60, 60), font=font_body)
    draw.text((30, 520), "Email: consumer.care@itc.in", fill=(60, 60, 60), font=font_body)
    draw.text((30, 565), "Country of Origin: India", fill=(40, 40, 40), font=font_body)
    
    draw_veg_symbol(draw, 780, 95, size=40)
    draw.rectangle([710, 600, 870, 710], outline=(0, 128, 0), width=2)
    draw.text((720, 620), "100% VEG", fill=(0, 128, 0), font=font_body_bold)
    draw.text((720, 655), "RECYCLABLE", fill=(0, 100, 0), font=font_small)
    draw.text((720, 680), "PP 05 PLASTIC", fill=(0, 100, 0), font=font_small)
    
    img.save(os.path.join(out_dir, "atta_1kg.jpg"), quality=95)

    # -------------------------------------------------------------
    # 2. BISCUITS VIOLATION (Non-SI unit 'gm', Missing 'all taxes')
    # -------------------------------------------------------------
    img = Image.new("RGB", (900, 750), color=(255, 252, 245))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 900, 70], fill=(200, 120, 20))
    draw.text((25, 20), "PACKAGED COMMODITY STATUTORY DECLARATION", fill=(255, 255, 255), font=font_title)
    
    draw.text((30, 95), "PARLE GLUCOSE CRUNCH BISCUITS", fill=(200, 80, 0), font=font_brand)
    draw.line([(30, 135), (870, 135)], fill=(200, 200, 200), width=2)
    
    # Violations: "200 gm" instead of "200 g" & MRP lacks "incl of all taxes"
    draw.text((30, 155), "Net Weight: 200 gm", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 205), "MRP: Rs. 30.00", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 255), "Date of Manufacture: 07/2026", fill=(40, 40, 40), font=font_body)
    draw.text((30, 300), "Manufactured by: Parle Biscuits Pvt Ltd", fill=(40, 40, 40), font=font_body_bold)
    draw.text((30, 345), "North Level Crossing, Vile Parle East, Mumbai - 400057", fill=(60, 60, 60), font=font_small)
    draw.text((30, 390), "FSSAI License No: 10013022000552", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 435), "Customer Helpline: 1800-222-111 | feedback@parle.biz", fill=(60, 60, 60), font=font_body)
    draw.text((30, 480), "Country of Origin: Made in India", fill=(40, 40, 40), font=font_body)
    
    draw_veg_symbol(draw, 780, 95, size=40)
    draw.rectangle([710, 600, 870, 710], outline=(100, 100, 100), width=2)
    draw.text((720, 630), "RECYCLABLE", fill=(60, 60, 60), font=font_body_bold)
    draw.text((720, 665), "PET 01", fill=(60, 60, 60), font=font_small)
    
    img.save(os.path.join(out_dir, "biscuit_violation.jpg"), quality=95)

    # -------------------------------------------------------------
    # 3. DRINK 750ML (Compliant - Mandatory USP Declared)
    # -------------------------------------------------------------
    img = Image.new("RGB", (900, 750), color=(248, 252, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 900, 70], fill=(0, 80, 160))
    draw.text((25, 20), "PACKAGED COMMODITY STATUTORY DECLARATION", fill=(255, 255, 255), font=font_title)
    
    draw.text((30, 95), "THUMS UP SPARKLING BEVERAGE", fill=(0, 60, 140), font=font_brand)
    draw.line([(30, 135), (870, 135)], fill=(200, 200, 200), width=2)
    
    draw.text((30, 155), "Net Volume: 750 ml", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 205), "MRP: Rs. 40.00 (Inclusive of all taxes)", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 255), "USP: Rs. 0.05 / ml", fill=(0, 100, 0), font=font_body_bold)
    draw.text((30, 305), "Date of Manufacture: 08/2026", fill=(40, 40, 40), font=font_body)
    draw.text((30, 350), "Best Before: 9 months from date of manufacture", fill=(40, 40, 40), font=font_body)
    draw.text((30, 395), "Manufactured by: Hindustan Coca-Cola Beverages Pvt Ltd", fill=(40, 40, 40), font=font_body_bold)
    draw.text((30, 440), "Address: Plot No. 18, Bidadi Industrial Area, Bengaluru, Karnataka - 562109", fill=(60, 60, 60), font=font_small)
    draw.text((30, 485), "FSSAI License No: 10014043000991", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 530), "Consumer Care: 1800-208-2653 | indiahelpline@coca-cola.com", fill=(60, 60, 60), font=font_body)
    draw.text((30, 575), "Country of Origin: India", fill=(40, 40, 40), font=font_body)
    
    draw_veg_symbol(draw, 780, 95, size=40)
    draw.rectangle([710, 600, 870, 710], outline=(0, 120, 200), width=2)
    draw.text((720, 630), "RECYCLABLE", fill=(0, 80, 160), font=font_body_bold)
    draw.text((720, 665), "PET 01 BOTTLE", fill=(0, 80, 160), font=font_small)
    
    img.save(os.path.join(out_dir, "drink_750ml.jpg"), quality=95)

    # -------------------------------------------------------------
    # 4. SOAP 125G (Compliant - TFM Grade 1 + M-Lic)
    # -------------------------------------------------------------
    img = Image.new("RGB", (900, 750), color=(255, 255, 250))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 900, 70], fill=(200, 140, 0))
    draw.text((25, 20), "PACKAGED COMMODITY STATUTORY DECLARATION", fill=(255, 255, 255), font=font_title)
    
    draw.text((30, 95), "SANTOOR NATURAL SANDAL & TURMERIC SOAP", fill=(180, 100, 0), font=font_brand)
    draw.line([(30, 135), (870, 135)], fill=(200, 200, 200), width=2)
    
    draw.text((30, 155), "Net Weight: 125 g", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 205), "MRP: Rs. 65.00 (Inclusive of all taxes)", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 255), "USP: Rs. 0.52 / g", fill=(0, 100, 0), font=font_body_bold)
    draw.text((30, 305), "Mfg Date: 06/2026", fill=(40, 40, 40), font=font_body)
    draw.text((30, 350), "Total Fatty Matter: TFM 76% Grade 1 Soap", fill=(0, 120, 0), font=font_body_bold)
    draw.text((30, 395), "Cosmetic Mfg Lic No: M-KTK/28/1998", fill=(40, 40, 40), font=font_body_bold)
    draw.text((30, 440), "Manufactured by: Wipro Enterprises Pvt Ltd", fill=(40, 40, 40), font=font_body_bold)
    draw.text((30, 485), "Address: Doddakannelli, Sarjapur Road, Bengaluru, Karnataka - 560035", fill=(60, 60, 60), font=font_small)
    draw.text((30, 530), "Consumer Care Cell: 1800-425-1993 | crm.wc@wipro.com", fill=(60, 60, 60), font=font_body)
    draw.text((30, 575), "Country of Origin: India", fill=(40, 40, 40), font=font_body)
    
    img.save(os.path.join(out_dir, "soap_125g.jpg"), quality=95)

    # -------------------------------------------------------------
    # 5. EARBUDS VIOLATION (Missing Country of Origin under Rule 6(1)(m))
    # -------------------------------------------------------------
    img = Image.new("RGB", (900, 750), color=(245, 247, 250))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 900, 70], fill=(40, 40, 40))
    draw.text((25, 20), "ELECTRONIC PACKAGED COMMODITY DECLARATION", fill=(255, 255, 255), font=font_title)
    
    draw.text((30, 95), "BOAT AIRDOPES WIRELESS STEREO EARPHONES", fill=(20, 20, 20), font=font_brand)
    draw.line([(30, 135), (870, 135)], fill=(200, 200, 200), width=2)
    
    draw.text((30, 155), "Net Quantity: 1 N (1 Unit)", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 185), "Contains: 1 Pair Earbuds, 1 Charging Case, 1 USB Cable", fill=(60, 60, 60), font=font_small)
    draw.text((30, 215), "MRP: Rs. 1499.00 (Inclusive of all taxes)", fill=(20, 20, 20), font=font_body_bold)
    draw.text((30, 260), "Month & Year of Import: 07/2026", fill=(40, 40, 40), font=font_body)
    draw.text((30, 305), "Dimensions: 6.2 cm x 4.8 cm x 2.6 cm", fill=(40, 40, 40), font=font_body)
    draw.text((30, 350), "Marketed by: Imagine Marketing Limited", fill=(40, 40, 40), font=font_body_bold)
    draw.text((30, 395), "Unit 505, Supreme Chambers, Andheri West, Mumbai, Maharashtra - 400053", fill=(60, 60, 60), font=font_small)
    draw.text((30, 440), "Consumer Care: 022-69181920 | info@imaginemarketingindia.com", fill=(60, 60, 60), font=font_body)
    # Origin is intentionally omitted to trigger Rule 6(1)(m) violation
    draw.text((30, 485), "Country of Origin: Not Declared", fill=(180, 0, 0), font=font_body_bold)
    
    # BIS CRS Stamp
    draw.rectangle([700, 600, 870, 710], outline=(0, 0, 0), width=2)
    draw.text((710, 620), "BIS STANDARD", fill=(0, 0, 0), font=font_body_bold)
    draw.text((710, 655), "IS 616:2017", fill=(50, 50, 50), font=font_small)
    draw.text((710, 680), "R-41001234", fill=(50, 50, 50), font=font_small)
    
    img.save(os.path.join(out_dir, "earbuds_violation.jpg"), quality=95)
    print("All 5 presets generated successfully in presets/!")

if __name__ == "__main__":
    create_all_presets()
