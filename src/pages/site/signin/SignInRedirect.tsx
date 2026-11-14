/* G6: the six retired sign-in addresses (/login, /signup, /reset-password, /reset-password/:token, /verify-email,
   /verify-email/:token) open Home with the dialog over it on the matching view. The query (the destination, an emailed
   link's code or token), the path's token (as `?token=`) and the hash (an implicit-flow session or error) are carried
   whole, so the views read the link exactly as the pages did. */

import { Navigate, useLocation, useParams } from "react-router-dom";

import { addressFor, type SignInView } from "./signinUrl";

export function SignInRedirect({ view }: { view: SignInView }) {
  const { search, hash } = useLocation();
  const { token } = useParams();
  return <Navigate to={addressFor(view, search, hash, token)} replace />;
}

export default SignInRedirect;
