import axios from "axios";

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