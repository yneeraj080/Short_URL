import axios from "axios";

// Backend origin. Override at build time with REACT_APP_API_URL; otherwise
// assume the backend runs on port 5000 of the host serving this page.
export const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    `${window.location.protocol}//${window.location.hostname}:5000`;

const API= axios.create({
    baseURL: API_BASE_URL,
});

API.interceptors.request.use((req)=>{
    const token = localStorage.getItem("token");
    if(token){
        req.headers.Authorization=`Bearer ${token}`;
    }
    return req;
});

// A 401 means the token is missing, expired or invalid: clear the stored
// session and send the user to the login page.
API.interceptors.response.use(
    (res)=>res,
    (error)=>{
        if(error.response?.status===401){
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            if(window.location.pathname!=="/login"){
                window.location.assign("/login");
            }
        }
        return Promise.reject(error);
    }
);

export default API;