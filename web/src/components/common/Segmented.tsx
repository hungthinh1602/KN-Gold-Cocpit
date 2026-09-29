/** Nhóm nút chọn 1 (kiểu "tfsel"): khung giờ, kỳ thống kê, nguồn lệnh… */
export interface SegOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <span className="tfsel">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}
