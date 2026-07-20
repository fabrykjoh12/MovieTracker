import { Link } from "react-router-dom";

interface SectionHeaderAction {
  text: string;
  to?: string;
  onClick?: () => void;
}

interface SectionHeaderProps {
  label?: string;
  title: string;
  action?: SectionHeaderAction;
}

export function SectionHeader({ label, title, action }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <div>
        {label && <p className="section-kicker">{label}</p>}
        <h2 className="section-title">{title}</h2>
      </div>
      {action &&
        (action.to ? (
          <Link className="section-action" to={action.to}>
            {action.text}
          </Link>
        ) : (
          <button
            type="button"
            className="section-action"
            onClick={action.onClick}
          >
            {action.text}
          </button>
        ))}
    </header>
  );
}
