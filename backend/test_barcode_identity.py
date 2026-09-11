"""Deterministic fixtures; registry entries below are simulated, not live GS1 data."""
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np
import zxingcpp
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from barcode_identity import Base, InspectionRecord, RegistryReview, build_review, compare_field, decode_barcodes, get_db, gtin_from_symbol, normalize_gtin, router

GTIN = "9506000140445"


def label():
    barcode = np.array(zxingcpp.write_barcode(zxingcpp.BarcodeFormat.EAN13, GTIN, width=700, height=180))
    image = np.full((900, 1000), 255, np.uint8)
    for i, text in enumerate(["FIXTURE ONLY - NOT A GS1 REGISTRY RECORD", "Example Foods Private Limited", "Classic Oat Biscuits", "Net quantity 200 g", "MRP Rs. 99.00 inclusive of all taxes", "Packed Aug 2026; Best before Feb 2027", "Consumer care: support@example.com"]):
        cv2.putText(image, text, (35, 65 + i * 45), cv2.FONT_HERSHEY_SIMPLEX, .75, 0, 2)
    image[410:410+barcode.shape[0],35:35+barcode.shape[1]] = barcode
    return image


class BarcodeIdentityTests(unittest.TestCase):
    def test_gtin_validation_and_leading_zero_equivalence(self):
        for value in [GTIN, "96385074", "012345678905", "0"+GTIN]:
            self.assertEqual(normalize_gtin(value),value)
        for value in ["9506000140446","1234567","12345678901","00000000","９５０６０００１４０４４５", "<script>"]:
            with self.assertRaises(ValueError): normalize_gtin(value)
        self.assertEqual(gtin_from_symbol('https://id.gs1.org/01/0'+GTIN+'?10=ABC','QR Code'),'0'+GTIN)
        self.assertIsNone(gtin_from_symbol(GTIN,'QR Code'))

    def test_real_decoder_rotations_and_non_gtin_qr(self):
        image=label()
        for rotation in range(4):
            self.assertEqual(decode_barcodes(np.rot90(image,rotation).copy(),rotation+1)[0]['gtin'],GTIN)
        self.assertEqual(decode_barcodes(np.full((300,400),255,np.uint8),1),[])
        qr=np.array(zxingcpp.write_barcode(zxingcpp.BarcodeFormat.QRCode,'https://example.com/serial/123',width=300,height=300))
        self.assertEqual(decode_barcodes(qr,1),[])

    def test_comparison_keeps_uncertainty_and_photo_evidence(self):
        photos=[{'photo_number':2,'text':'Example Foods Private Limited\nClassic Oat Biscuits 200 g'}]
        self.assertEqual(compare_field('EXAMPLE FOODS PRIVATE LIMITED',photos)['evidence'][0]['photo_number'],2)
        self.assertEqual(compare_field('Different Foods',photos)['status'],'needs_review')
        self.assertEqual(compare_field('Oat Biscuit',photos)['status'],'needs_review')
        self.assertEqual(compare_field('',photos)['status'],'not_available')
        payload={'barcodes':[{'gtin':GTIN}],'label_photos':photos}
        request=RegistryReview(gtin=GTIN,registry_gtin='0'+GTIN,company='Example Foods Private Limited',confirmed=True)
        review=build_review(request,payload)
        self.assertFalse(review['api_verified'])
        self.assertEqual(review['registry_source'],'reviewer_entered')
        self.assertEqual(review['comparison']['product']['status'],'not_available')
        request.registry_gtin='8902579002114'
        with self.assertRaisesRegex(ValueError,'different GTIN'): build_review(request,payload)
        request.registry_gtin=GTIN;request.outcome='not_found'
        review=build_review(request,payload)
        self.assertEqual(review['status'],'needs_review')
        self.assertEqual(review['comparison']['company']['registry_value'],'')
        request.outcome='found';request.company=''
        with self.assertRaises(ValueError): build_review(request,payload)
        request.company='Example Foods Private Limited'
        self.assertEqual(build_review(request,{'barcodes':[],'label_photos':photos})['barcode_source'],'manually_entered')

    def test_api_persistence_wrong_gtin_and_photo_integrity(self):
        database=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(database)
        def db_session():
            with Session(database) as db: yield db
        app=FastAPI();app.include_router(router);app.dependency_overrides[get_db]=db_session
        previous=Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory);Path('uploads').mkdir()
                _,encoded=cv2.imencode('.png',label());content=encoded.tobytes()
                Path('uploads/sample-1.original').write_bytes(content)
                digest=hashlib.sha256(content).hexdigest()
                photo={'photo_number':1,'image_url':'/uploads/sample-1.original','sha256':digest,'text':['Example Foods Private Limited','Classic Oat Biscuits']}
                Path('uploads/sample.json').write_text(json.dumps({'photos':[photo]}))
                multiple=[photo,{**photo,'photo_number':2}]
                multiple_hash=hashlib.sha256(json.dumps(multiple,sort_keys=True).encode()).hexdigest()
                Path('uploads/multiple.json').write_text(json.dumps({'photos':multiple}))
                with Session(database) as db:
                    db.add(InspectionRecord(id=1,image_filename='sample.jpg',evidence_sha256=digest,rule_verifications={'mrp':{'status':'REVIEW'}}))
                    db.add(InspectionRecord(id=2,image_filename='sample.jpg',evidence_sha256=digest))
                    db.add(InspectionRecord(id=3,image_filename='multiple.jpg',evidence_sha256=multiple_hash))
                    db.commit()
                with TestClient(app) as client:
                    url='/api/inspections/1/barcode-identity'
                    decoded=client.get(url)
                    self.assertEqual(decoded.status_code,200)
                    self.assertEqual(decoded.headers['cache-control'],'no-store')
                    self.assertEqual(decoded.json()['barcodes'][0]['gtin'],GTIN)
                    combined=client.get('/api/inspections/3/barcode-identity')
                    self.assertEqual(combined.status_code,200)
                    self.assertEqual(combined.json()['barcodes'][0]['photo_numbers'],[1,2])
                    request={'gtin':GTIN,'registry_gtin':GTIN,'company':'Example Foods Private Limited','confirmed':True}
                    saved=client.post(url,json=request)
                    self.assertEqual(saved.status_code,200)
                    self.assertEqual(client.get(url).json()['reviews'],saved.json()['reviews'])
                    self.assertEqual(client.post(url,json={**request,'registry_gtin':'8902579002114'}).status_code,422)
                    self.assertEqual(client.post(url,json={**request,'confirmed':False}).status_code,422)
                    self.assertEqual(client.post(url,json={**request,'company':'x'*301}).status_code,422)
                    self.assertEqual(client.get('/api/inspections/999/barcode-identity').status_code,404)
                    Path('uploads/sample-1.original').write_bytes(b'tampered')
                    self.assertEqual(client.get('/api/inspections/2/barcode-identity').status_code,409)
                    photo['sha256']=hashlib.sha256(b'tampered').hexdigest()
                    Path('uploads/sample.json').write_text(json.dumps({'photos':[photo]}))
                    self.assertEqual(client.get('/api/inspections/2/barcode-identity').status_code,409)
                with Session(database) as db:
                    self.assertEqual(db.get(InspectionRecord,1).rule_verifications,{'mrp':{'status':'REVIEW'}})
            finally:
                os.chdir(previous);database.dispose()


if __name__=='__main__': unittest.main()
