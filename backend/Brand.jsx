export default function Brand({ turf, size = "md" }) {
  const dims = size === "lg" ? 56 : size === "sm" ? 28 : 40;
  const initial = (turf?.name || "T").trim().charAt(0).toUpperCase();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {turf?.logo_url || turf?.logoUrl ? (
        <img
          src={turf.logo_url || turf.logoUrl}
          alt={`${turf.name} logo`}
          style={{ width: dims, height: dims, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid #12130F14" }}
        />
      ) : (
        <div
          style={{
            width: dims,
            height: dims,
            borderRadius: 10,
            background: "#12130F",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#C6FF3C",
            fontWeight: 800,
            fontSize: dims * 0.45,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
      )}
      <div>
        <div style={{ fontWeight: 700, fontSize: size === "lg" ? 22 : 15, color: "#12130F", lineHeight: 1.15 }}>
          {turf?.name || "Your turf"}
        </div>
        {turf?.location && <div style={{ fontSize: 11.5, color: "#6B6A63" }}>{turf.location}</div>}
        {(turf?.website_url || turf?.websiteUrl) && (
          <a
            href={turf.website_url || turf.websiteUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11.5, color: "#5C8A00", fontWeight: 600 }}
          >
            {(turf.website_url || turf.websiteUrl).replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
    </div>
  );
}
