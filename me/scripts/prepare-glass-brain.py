"""Sample the original glTF point primitives for the landing-page renderer."""
import json
import struct
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with zipfile.ZipFile(root / "Glass_Brain.zip") as archive:
    model = json.loads(archive.read("Glass_Brain.gltf"))
    buffer = archive.read("Glass_Brain.bin")

positions = []
for mesh in model["meshes"]:
    for primitive in mesh["primitives"]:
        if primitive.get("mode") != 0:  # The archive also contains a bounding box.
            continue
        accessor = model["accessors"][primitive["attributes"]["POSITION"]]
        view = model["bufferViews"][accessor["bufferView"]]
        start = view["byteOffset"] + accessor.get("byteOffset", 0)
        for index in range(0, accessor["count"], 41):
            positions.append(struct.unpack_from("<3f", buffer, start + index * view["byteStride"]))

bounds = [(min(axis), max(axis)) for axis in zip(*positions)]
center = [(low + high) / 2 for low, high in bounds]
scale = 65532 / max(high - low for low, high in bounds)
with (root / "public/glass-brain-points.bin").open("wb") as out:
    for point in positions:
        out.write(struct.pack("<3h", *(round((v - c) * scale) for v, c in zip(point, center))))
