type TabButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

export function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      className={`tab-chip ${active ? "tab-chip-active" : "tab-chip-idle"}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
