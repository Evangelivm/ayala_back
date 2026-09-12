from __future__ import annotations

import io

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from rapidocr import RapidOCR

app = FastAPI(title="Receipt OCR")

# Se carga una sola vez al iniciar el contenedor — cargarlo por request sería
# lentísimo (implica leer los pesos del modelo cada vez).
#
# Se usa rapidocr (ONNXRuntime) en vez del motor nativo de PaddlePaddle: en
# CPUs virtualizadas/antiguas sin AVX/SSE4 (comunes en VPS baratos) el kernel
# de convolución depthwise de PaddlePaddle crashea con "Illegal instruction"
# (SIGILL). ONNXRuntime detecta la CPU correctamente y no tiene ese problema.
#
# "es" está soportado directamente por el modelo multilenguaje PP-OCRv6 de
# esta librería (no hace falta pedir un bucket "latin" como en PaddleOCR viejo).
ocr = RapidOCR(params={"Rec.lang_type": "es"})


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def extract_text(file: UploadFile = File(...)):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Archivo vacío")

    try:
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"No se pudo leer la imagen: {e}")

    result = ocr(np.array(image))

    lines = []
    text_parts = []

    boxes = result.boxes if result.boxes is not None else []
    txts = result.txts if result.txts is not None else []
    scores = result.scores if result.scores is not None else []

    for box, text, confidence in zip(boxes, txts, scores):
        box_list = box.tolist() if hasattr(box, "tolist") else box
        lines.append({"text": text, "confidence": round(float(confidence), 4), "box": box_list})
        text_parts.append(text)

    return {"lines": lines, "text": "\n".join(text_parts)}
