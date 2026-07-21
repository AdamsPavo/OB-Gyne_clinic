import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { api } from "../api/client";

import {
  User,
  Lock,
  Eye,
  EyeOff,
  CalendarDays,
  HeartPulse,
  FileText,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

import Logo from "../assets/OB-bg.png";
import OBlogo from "../assets/OBLOGO.png";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    api("/auth/setup-status")
      .then((data) => {
        setConfigured(data.configured);
      })
      .catch(() => {
        setConfigured(true);
      });
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);

      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          username: username.trim(),
          password,
        }
      );

      const { token, user } = response.data;

      if (!token || !user) {
        throw new Error("Invalid login response.");
      }

      localStorage.setItem("obgyn_token", token);

      localStorage.setItem(
        "currentUser",
        JSON.stringify(user)
      );

      // Remove the old storage key to avoid confusion.
      localStorage.removeItem("user");

      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      console.error("Login failed:", error);

      alert(
        error.response?.data?.message ||
          error.message ||
          "Invalid username or password"
      );
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: (
        <HeartPulse className="mx-auto text-pink-500" />
      ),
      title: "Patient Care",
      text: "Comprehensive women's healthcare.",
    },
    {
      icon: (
        <CalendarDays className="mx-auto text-pink-500" />
      ),
      title: "Appointments",
      text: "Easy scheduling and reminders.",
    },
    {
      icon: (
        <FileText className="mx-auto text-pink-500" />
      ),
      title: "Medical Records",
      text: "Secure patient records.",
    },
  ];

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-linear-to-br from-[#fff7fa] via-white to-[#ffe6ef]">
      <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-pink-200/30 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-112.5 w-112.5 rounded-full bg-rose-200/30 blur-3xl" />

      <div className="hidden w-1/2 items-center justify-center px-20 lg:flex">
        <div className="flex h-full w-full flex-col justify-center text-center">
          <img
            src={Logo}
            alt="OB-GYN Clinic"
            className="mx-auto w-full max-w-3xl object-contain"
          />

          <div className="mt-10 grid grid-cols-3 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-pink-100 bg-white p-6 shadow-lg"
              >
                {feature.icon}

                <h3 className="mt-4 font-semibold">
                  {feature.title}
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  {feature.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md rounded-[40px] border border-white/30 bg-linear-to-br from-pink-500/90 via-rose-400/90 to-pink-300/90 p-10 shadow-[0_25px_70px_rgba(236,72,153,.35)] backdrop-blur-2xl">
          <div className="relative mb-8 flex justify-center">
            <div className="absolute h-44 w-44 rounded-full bg-white opacity-40 blur-xl" />

            <div className="relative rounded-full bg-white p-5 shadow-2xl">
              <img
                src={OBlogo}
                alt="Clinic Logo"
                className="h-32 w-32 object-contain"
              />
            </div>
          </div>

          <h2 className="text-center text-5xl font-bold text-gray-800">
            Welcome Back
          </h2>

          <p className="mb-8 mt-3 text-center text-gray-600">
            Login to access your clinic dashboard
          </p>

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="username"
                className="text-sm font-semibold text-gray-800"
              >
                Username
              </label>

              <div className="relative mt-2">
                <User
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500"
                />

                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  className="w-full rounded-2xl border border-pink-100 bg-white py-4 pl-12 pr-4 shadow-sm outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-semibold text-gray-800"
              >
                Password
              </label>

              <div className="relative mt-2">
                <Lock
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500"
                />

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  className="w-full rounded-2xl border border-pink-100 bg-white py-4 pl-12 pr-12 shadow-sm outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (previous) => !previous
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition hover:text-pink-500"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  className="accent-pink-500"
                />

                Remember me
              </label>

              <button
                type="button"
                className="font-medium text-pink-600 transition hover:text-pink-700"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-pink-500 to-rose-500 py-4 font-semibold text-white transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                "Logging in..."
              ) : (
                <>
                  Login
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            {!configured && (
              <p className="mb-4 text-sm text-gray-700">
                First time here?{" "}
                <Link
                  to="/register"
                  className="font-semibold text-pink-700 hover:text-pink-800"
                >
                  Set up the clinic
                </Link>
              </p>
            )}

            <div className="flex items-center justify-center gap-2 text-pink-700">
              <ShieldCheck size={18} />

              <span className="text-sm">
                Secure • Private • Trusted
              </span>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              © 2026 Perdido OB-GYN Clinic
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}