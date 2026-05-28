export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(value)}`;
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt="QR code"
      className="rounded-lg bg-white p-2"
    />
  );
}
