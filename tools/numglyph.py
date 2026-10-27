"""Sinh assets/numerals.js: nét chữ số 0–5 của Google Sans Flex tại K mốc đều dọc đường biến hình của số chương.

Số chương nền (site.css .chap-num) biến hình mảnh-hẹp-đứng → đậm-hẹp-nghiêng khi chương sáng lên. Đổi trục phông mỗi khung
thì Chrome dựng một bản phông mới mỗi khung (đo #302: ~2–4 ms/khung trên máy tính, ×4–6 trên điện thoại) → vẽ số bằng SVG,
nội suy nét. Cấu trúc lệnh (M/L/Q/Z) chỉ phụ thuộc cờ on/off-curve của glyph nên giống hệt giữa mọi mốc trục ⇒ nội suy từng
toạ độ là đúng; K=9 mốc đều lệch tối đa ~1,4 đơn vị phông so với nét thật (0,3 px ở cỡ 24rem; K=5 lệch 5,7 px).

Chạy (cần `pip install fonttools brotli`):
  1. Lấy tệp woff2 bộ "latin" từ CSS của Google Fonts (link phông trong index.html, gửi kèm User-Agent trình duyệt mới).
  2. python tools/numglyph.py <latin.woff2> assets/numerals.js
Đổi đường trục (A, B dưới đây) thì sửa luôn ghi chú trong site.css .chap-num và chạy lại.
"""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

A = {'wght': 100, 'wdth': 25, 'slnt': 0, 'ROND': 100}
B = {'wght': 900, 'wdth': 64, 'slnt': -10, 'ROND': 100}
DIG = '012345'
K = 9


def outline(coords, on, ends):
    """Glyph TrueType → (chuỗi lệnh, toạ độ phẳng). y lật âm (SVG y hướng xuống). Điểm on-curve ngầm giữa hai điểm off-curve
    là trung điểm — hàm tuyến tính của toạ độ, nên nội suy toạ độ đã sinh vẫn đúng."""
    cmds, nums, st = [], [], 0
    for e in ends:
        P = [(x, -y) for x, y in coords[st:e + 1]]; O = on[st:e + 1]; st = e + 1; n = len(P)
        if any(O):
            s = O.index(1); seq = [(P[(s + i) % n], O[(s + i) % n]) for i in range(n)]; start = seq[0][0]; seq = seq[1:]
        else:
            start = ((P[-1][0] + P[0][0]) / 2, (P[-1][1] + P[0][1]) / 2); seq = [(p, 0) for p in P]
        cmds.append('M'); nums += start
        q = None
        for p, o in seq:
            if o:
                if q is None: cmds.append('L'); nums += p
                else: cmds.append('Q'); nums += q + p; q = None
            else:
                if q is not None: cmds.append('Q'); nums += q + ((q[0] + p[0]) / 2, (q[1] + p[1]) / 2)
                q = p
        if q is not None: cmds.append('Q'); nums += q + start
        cmds.append('Z')
    return ''.join(cmds), nums


def main(src, dst):
    cm = TTFont(src).getBestCmap(); names = {c: cm[ord(c)] for c in DIG}
    out = {c: {'c': None, 'a': [], 'p': []} for c in DIG}
    for i in range(K):
        u = i / (K - 1)
        f = instancer.instantiateVariableFont(TTFont(src), {k: A[k] + (B[k] - A[k]) * u for k in A})
        g = f['glyf']
        for c in DIG:
            gl = g[names[c]]; co, ends, fl = gl.getCoordinates(g)
            cmd, nums = outline(list(co), [x & 1 for x in fl], list(ends))
            assert out[c]['c'] in (None, cmd), 'cấu trúc nét khác giữa các mốc: ' + c
            out[c]['c'] = cmd; out[c]['a'].append(f['hmtx'][names[c]][0]); out[c]['p'].append([round(v) for v in nums])
    head = ('/* Nét chữ số 0–5 của Google Sans Flex (bộ latin) tại %d mốc đều dọc đường biến hình của số chương: %s → %s.\n'
            '   Sinh bằng tools/numglyph.py — đổi đường trục hay bản phông thì chạy lại. c: lệnh M/L/Q/Z (giống hệt mọi mốc),\n'
            '   a: bước tiến từng mốc, p: toạ độ từng mốc (đơn vị phông, upm 2000, y hướng xuống). */\n') % (
        K, ' '.join('%s %g' % kv for kv in A.items()), ' '.join('%s %g' % kv for kv in B.items()))
    with open(dst, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(head + 'window.CryoNum=' + json.dumps({'upm': 2000, 'k': K, 'g': out}, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
