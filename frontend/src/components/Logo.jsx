import { Link } from "react-router-dom";

// Two versions of the wordmark: dark text for light theme, light text for dark.
const Logo = ({ className = "h-8" }) => (
  <Link to="/" className="inline-flex items-center" aria-label="SnipQR home">
    <img src="/logo.svg" alt="SnipQR" className={`${className} dark:hidden`} />
    <img src="/logo-dark.svg" alt="SnipQR" className={`${className} hidden dark:block`} />
  </Link>
);

export default Logo;
