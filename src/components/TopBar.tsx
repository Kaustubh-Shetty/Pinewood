import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TopBar() {
  const { flatId, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        Pinewood
      </Link>
      <div className="topbar-right">
        <span className="flat-badge">{flatId}</span>
        <button
          className="link-button"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
        >
          Log out
        </button>
      </div>
    </header>
  );
}
