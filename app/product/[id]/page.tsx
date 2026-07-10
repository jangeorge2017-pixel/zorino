import Link from "next/link";

export default function ProductPage() {
  return (
    <div
      style={{
        padding: "50px",
        direction: "rtl",
        textAlign: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://picsum.photos/500/300"
        alt="منتج"
        style={{
          width: "500px",
          maxWidth: "100%",
          borderRadius: "15px",
        }}
      />

      <h1 style={{ marginTop: "20px" }}>هاتف ذكي</h1>

      <h2 style={{ color: "#00aaff" }}>5000 جنيه</h2>

      <p
        style={{
          maxWidth: "700px",
          margin: "20px auto",
          lineHeight: "2",
        }}
      >
        هذا وصف تجريبي للمنتج. لاحقاً سيتم جلب البيانات من قاعدة البيانات أو من
        AliExpress و Alibaba.
      </p>

      <Link href="/cart">
        <button
          type="button"
          style={{
            background: "#00aaff",
            color: "white",
            border: "none",
            padding: "15px 30px",
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          أضف إلى السلة
        </button>
      </Link>

      <br />
      <br />

      <Link href="/">العودة للمتجر</Link>
    </div>
  );
}
