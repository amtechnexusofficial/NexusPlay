export default function Notification({ items }) {
  if (!items.length) return null;
  return (
    <>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            background: item.kind === "success" ? "#12130F" : item.kind === "error" ? "#FF5A3C" : "#fff",
            color: item.kind === "info" ? "#12130F" : item.kind === "success" ? "#C6FF3C" : "#fff",
            border: "1px solid rgba(18,19,15,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 14px rgba(18,19,15,0.12)",
          }}
        >
          {item.msg}
        </div>
      ))}
    </>
  );
}
