
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
  User, Lock, Eye, EyeOff,
  CalendarDays, HeartPulse, FileText,
  ShieldCheck, ArrowRight
} from "lucide-react";

import Logo from "../assets/OB-bg.png";
import OBlogo from "../assets/OBLOGO.png";

export default function Login() {

  const navigate = useNavigate();

  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [showPassword,setShowPassword] = useState(false);
  const [loading,setLoading] = useState(false);


  const handleLogin = async(e)=>{

    e.preventDefault();

    try{

      setLoading(true);


      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          username,
          password
        }
      );


      // save token
      localStorage.setItem(
        "token",
        response.data.token
      );


      navigate("/dashboard");


    }catch(error){

      alert(
        error.response?.data?.message ||
        "Invalid username or password"
      );

    }finally{

      setLoading(false);

    }

  };


  const features = [
    { 
      icon:<HeartPulse className="text-pink-500 mx-auto"/>,
      title:"Patient Care",
      text:"Comprehensive women's healthcare."
    },
    {
      icon:<CalendarDays className="text-pink-500 mx-auto"/>,
      title:"Appointments",
      text:"Easy scheduling and reminders."
    },
    {
      icon:<FileText className="text-pink-500 mx-auto"/>,
      title:"Medical Records",
      text:"Secure patient records."
    },
  ];


  return (

    <div className="min-h-screen flex bg-linear-to-br from-[#fff7fa] via-white to-[#ffe6ef] overflow-hidden relative">

      <div className="absolute -top-40 -left-40 w-125 h-125 rounded-full bg-pink-200/30 blur-3xl"/>
      <div className="absolute bottom-0 right-0 w-112.5 h-112.5 rounded-full bg-rose-200/30 blur-3xl"/>


      <div className="hidden lg:flex w-1/2 items-center justify-center px-20">

        <div className="text-center h-full w-full flex flex-col justify-center">

          <img 
            src={Logo}
            alt="Hero"
            className="w-220r mx-auto"
          />


          <div className="grid grid-cols-3 gap-5 mt-10">

            {features.map((f)=>(

              <div 
                key={f.title}
                className="bg-white rounded-3xl p-6 shadow-lg border border-pink-100"
              >

                {f.icon}

                <h3 className="font-semibold mt-4">
                  {f.title}
                </h3>

                <p className="text-sm text-gray-500 mt-2">
                  {f.text}
                </p>

              </div>

            ))}

          </div>

        </div>

      </div>



      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">


        <div className="w-full max-w-md bg-linear-to-br from-pink-500/90 via-rose-400/90 to-pink-300/90 backdrop-blur-2xl rounded-[40px] border border-white/30 shadow-[0_25px_70px_rgba(236,72,153,.35)] p-10">


          <div className="flex justify-center mb-8 relative">

            <div className="absolute w-44 h-44 rounded-full bg-white opacity-40 blur-xl"></div>


            <div className="relative bg-white rounded-full p-5 shadow-2xl">

              <img
                src={OBlogo}
                alt="Logo"
                className="w-32 h-32 object-contain"
              />

            </div>

          </div>



          <h2 className="text-center text-5xl font-bold text-gray-800">
            Welcome Back
          </h2>


          <p className="text-center text-gray-500 mt-3 mb-8">
            Login to access your clinic dashboard
          </p>



          <form onSubmit={handleLogin} className="space-y-5">


            <div>

              <label className="font-semibold text-sm">
                Username
              </label>


              <div className="relative mt-2">

                <User 
                  size={20}
                  className="absolute left-4 top-4 text-pink-500"
                />


                <input

                  value={username}

                  onChange={
                    e=>setUsername(e.target.value)
                  }

                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-pink-100 shadow-sm focus:ring-2 focus:ring-pink-300 outline-none"

                  placeholder="Enter username"

                  required

                />

              </div>

            </div>



            <div>

              <label className="font-semibold text-sm">
                Password
              </label>


              <div className="relative mt-2">


                <Lock
                  size={20}
                  className="absolute left-4 top-4 text-pink-500"
                />


                <input

                  type={
                    showPassword
                    ? "text"
                    : "password"
                  }

                  value={password}

                  onChange={
                    e=>setPassword(e.target.value)
                  }

                  className="w-full pl-12 pr-12 py-4 rounded-2xl border border-pink-100 shadow-sm focus:ring-2 focus:ring-pink-300 outline-none"

                  placeholder="Enter password"

                  required

                />



                <button

                  type="button"

                  onClick={
                    ()=>setShowPassword(!showPassword)
                  }

                  className="absolute right-4 top-4 text-gray-500"

                >

                  {
                    showPassword
                    ?
                    <EyeOff size={20}/>
                    :
                    <Eye size={20}/>
                  }

                </button>


              </div>

            </div>



            <div className="flex justify-between text-sm">

              <label className="flex items-center gap-2">

                <input type="checkbox"/>

                Remember me

              </label>


              <button 
                type="button"
                className="text-pink-500"
              >
                Forgot Password?
              </button>


            </div>




            <button

              type="submit"

              disabled={loading}

              className="w-full py-4 rounded-2xl bg-linear-to-r from-pink-500 to-rose-500 text-white font-semibold flex items-center justify-center gap-2 hover:-translate-y-1 transition disabled:opacity-50"

            >

              {
                loading
                ?
                "Logging in..."
                :
                <>
                  Login
                  <ArrowRight size={18}/>
                </>
              }

            </button>


          </form>




          <div className="mt-8 text-center">

            <div className="flex justify-center items-center gap-2 text-pink-500">

              <ShieldCheck size={18}/>

              <span className="text-sm">
                Secure • Private • Trusted
              </span>

            </div>


            <p className="text-xs text-gray-400 mt-2">
              © 2026 Perdido OB-GYN Clinic
            </p>


          </div>


        </div>


      </div>


    </div>

  );
}
