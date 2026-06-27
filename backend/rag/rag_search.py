import argparse
import json
import os
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parent
DEFAULT_DOCS = ROOT / "trusted_sources.json"
DEFAULT_INDEX_DIR = ROOT / "index"


def chunk_text(text, size=700, overlap=120):
    clean = " ".join(str(text or "").split())
    if len(clean) <= size:
        return [clean] if clean else []
    chunks = []
    start = 0
    while start < len(clean):
        end = min(len(clean), start + size)
        chunks.append(clean[start:end])
        if end == len(clean):
            break
        start = max(0, end - overlap)
    return chunks


def load_documents(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        docs = json.load(handle)
    chunks = []
    for doc in docs:
        for index, text in enumerate(chunk_text(doc.get("text", ""))):
            chunks.append(
                {
                    "id": f"{doc.get('source', 'source')}:{index}",
                    "source": doc.get("source", "Trusted source"),
                    "title": doc.get("title", doc.get("source", "Trusted source")),
                    "text": text,
                    "url": doc.get("url", "#"),
                    "trusted": bool(doc.get("trusted", True)),
                }
            )
    return chunks


def load_model(model_name):
    return SentenceTransformer(model_name)


def build_index(model, docs, index_dir):
    index_dir.mkdir(parents=True, exist_ok=True)
    corpus = [f"{doc['title']}. {doc['text']}" for doc in docs]
    vectors = model.encode(corpus, normalize_embeddings=True, show_progress_bar=False)
    vectors = np.asarray(vectors, dtype="float32")
    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors)
    faiss.write_index(index, str(index_dir / "trusted.faiss"))
    (index_dir / "trusted.meta.json").write_text(json.dumps(docs, ensure_ascii=False), encoding="utf-8")
    return index


def load_or_build_index(model, docs, index_dir):
    index_file = index_dir / "trusted.faiss"
    meta_file = index_dir / "trusted.meta.json"
    if index_file.exists() and meta_file.exists():
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        if len(meta) == len(docs):
            return faiss.read_index(str(index_file)), meta
    return build_index(model, docs, index_dir), docs


def search(query, top_k, model_name, docs_path, index_dir):
    docs = load_documents(docs_path)
    model = load_model(model_name)
    index, meta = load_or_build_index(model, docs, index_dir)
    query_vector = model.encode([query], normalize_embeddings=True, show_progress_bar=False)
    query_vector = np.asarray(query_vector, dtype="float32")
    scores, ids = index.search(query_vector, min(top_k, len(meta)))
    results = []
    for score, doc_id in zip(scores[0], ids[0]):
        if doc_id < 0:
            continue
        doc = meta[int(doc_id)]
        results.append(
            {
                "source": doc["source"],
                "explanation": f"{doc['title']}: {doc['text']}",
                "link": doc["url"],
                "trusted": doc["trusted"],
                "similarity": float(score),
                "retrieval": "faiss",
            }
        )
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--top_k", type=int, default=6)
    parser.add_argument("--model", default=os.environ.get("RAG_EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"))
    parser.add_argument("--docs", default=str(DEFAULT_DOCS))
    parser.add_argument("--index_dir", default=str(DEFAULT_INDEX_DIR))
    args = parser.parse_args()

    results = search(args.query, args.top_k, args.model, Path(args.docs), Path(args.index_dir))
    print(json.dumps({"engine": "faiss", "model": args.model, "results": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()
