import { useRef, useState } from 'react';
import { api } from '../api';
import { Img } from '../ui';

const MAX_EDGE = 1600;

/** Phone photos are 3-8MB; shrink to ~1600px JPEG before upload (falls back to the original file). */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export default function PhotoPicker({ value, onChange, label = 'Chụp / chọn ảnh', disabled }: { value: string | null | undefined; onChange: (path: string | null) => void; label?: string; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { path } = await api.upload(await shrink(file), file.name);
      onChange(path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <div className="photo-slot">
        <Img src={value ?? null} alt="Ảnh" className="thumb" />
        <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" className="btn sm" disabled={busy || disabled} onClick={() => input.current?.click()}>
          {busy ? 'Đang tải ảnh…' : value ? 'Đổi ảnh' : `📷 ${label}`}
        </button>
        {value && !disabled && (
          <button type="button" className="btn link" onClick={() => onChange(null)}>
            Xóa
          </button>
        )}
      </div>
      {error && <p className="overdue small">{error}</p>}
    </div>
  );
}
