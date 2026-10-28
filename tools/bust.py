"""Gắn dấu phiên bản (?v=<8 ký tự đầu SHA-1 nội dung>) vào mọi chỗ trang và mã trỏ tới một tệp trong assets/.

GitHub Pages trả mọi tệp với Cache-Control: max-age=600, và nút tải lại thường của Chrome chỉ hỏi lại trang HTML, còn
tệp JS/CSS/ảnh đã có trong bộ nhớ đệm dưới 10 phút thì dùng luôn. Sau một lần đẩy bản mới, người xem bấm tải lại vẫn có
thể chạy site.js cũ — #303: user kiểm "bản sửa" mà có thể vẫn đang chạy bản trước nó. Dấu đổi theo nội dung → địa chỉ
mới → trình duyệt buộc tải tệp mới; tệp không đổi giữ nguyên dấu, vẫn dùng bộ nhớ đệm.

Hai loại chỗ trỏ:
- thuộc tính href="assets/…" / src="assets/…" trong index.html, privacy.html;
- chuỗi 'assets/…' trong assets/*.js (tệp nạp bằng mã: perf.js, lenis.min.js, ảnh của Polar Run).
Mã JS làm trước (sửa site.js là đổi dấu của chính site.js), rồi mới tới trang. Cùng một tệp ở mọi chỗ mang cùng dấu, nên
ảnh vừa nằm trong HTML vừa được mã nạp lại vẫn chỉ tải một lần.

Chạy trước mỗi commit đổi tệp trong assets/:  python tools/bust.py
Chỉ kiểm (thoát mã 1 nếu còn dấu cũ):        python tools/bust.py --check
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ["index.html", "privacy.html"]
EXT = r"(?:css|js|webp|png|jpg|jpeg|svg|gif|woff2?)"
ATTR = re.compile(r'((?:href|src)=")(assets/[\w./-]+?\.' + EXT + r')(?:\?v=[0-9a-f]*)?(")')
QUOTED = re.compile(r"""(['"])(assets/[\w./-]+?\.""" + EXT + r""")(?:\?v=[0-9a-f]*)?(\1)""")


def stamp(rel: str, mem: dict) -> str:
    data = mem[rel].encode("utf-8") if rel in mem else (ROOT / rel).read_bytes()
    return hashlib.sha1(data).hexdigest()[:8]


def restamp(text: str, pat: re.Pattern, mem: dict, missing: list) -> str:
    def sub(m: re.Match) -> str:
        rel = m.group(2)
        if rel not in mem and not (ROOT / rel).is_file():
            missing.append(rel)
            return m.group(0)
        return m.group(1) + rel + "?v=" + stamp(rel, mem) + m.group(3)

    return pat.sub(sub, text)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):  # Windows chuyển hướng ra tệp/ống dẫn dùng cp1252 → lỗi ở chữ tiếng Việt
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    check = "--check" in sys.argv[1:]
    missing: list = []
    # Nội dung đã sửa (chưa ghi) theo đường dẫn tương đối — dấu của một tệp JS tính trên bản đã gắn dấu bên trong nó.
    mem: dict = {}
    scripts = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / "assets").glob("*.js") if not p.name.endswith(".min.js"))
    orig = {rel: (ROOT / rel).read_bytes().decode("utf-8") for rel in scripts + PAGES if (ROOT / rel).is_file()}
    for rel in scripts:
        mem[rel] = orig[rel]
    # Lặp tới khi không đổi: tệp JS trỏ tới tệp JS khác (site.js → perf.js) cần dấu của bản đã gắn của tệp kia.
    for _ in range(len(scripts) + 1):
        changed = False
        for rel in scripts:
            new = restamp(mem[rel], QUOTED, mem, missing)
            if new != mem[rel]:
                mem[rel], changed = new, True
        if not changed:
            break
    for rel in PAGES:
        if rel in orig:
            mem[rel] = restamp(orig[rel], ATTR, mem, missing)
    if missing:
        print("Không thấy tệp:", ", ".join(sorted(set(missing))))
        return 1
    stale = [rel for rel in mem if mem[rel] != orig[rel]]
    if not stale:
        print("Dấu phiên bản đã đúng.")
        return 0
    if check:
        print("Dấu phiên bản cũ trong:", ", ".join(stale), "— chạy: python tools/bust.py")
        return 1
    for rel in stale:
        (ROOT / rel).write_bytes(mem[rel].encode("utf-8"))  # giữ nguyên kiểu xuống dòng
    print("Đã cập nhật dấu phiên bản trong:", ", ".join(stale))
    return 0


if __name__ == "__main__":
    sys.exit(main())
