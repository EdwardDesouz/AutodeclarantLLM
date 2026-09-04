import axios from "axios";

const API = axios.create({
  baseURL: "http://192.168.1.40:8080/",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default API;
