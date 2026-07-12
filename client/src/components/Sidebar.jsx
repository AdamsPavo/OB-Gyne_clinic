import React from "react";
import Logo from "../assets/OBLOGO.png";

const menuItems = [
  { name: "Dashboard", icon: "⌂" },
  { name: "Patients", icon: "👩‍⚕️" },
  { name: "Appointments", icon: "📅" },
  { name: "Consultations", icon: "🩺" },
  { name: "Prenatal Records", icon: "🤰" },
  { name: "Prescriptions", icon: "💊" },
  { name: "Billing", icon: "💳" },
  { name: "Reports", icon: "📊" },
  { name: "Backup / Restore", icon: "💾" },
];

function Sidebar() {
  return (
    <aside className="h-screen w-72 bg-white shadow-xl border-r border-pink-100 flex flex-col">

      {/* Header */}
      <div className="px-6 py-6 bg-linear-to-br from-pink-500 to-rose-400 text-white">

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl">
            <img src={Logo} alt="Logo"  className="h-10 w-10"/>
          </div>

          <div>
            <h1 className="text-xl font-bold">
              OB-GYN Clinic
            </h1>

            <p className="text-sm text-pink-100">
              Management System
            </p>
          </div>
        </div>

      </div>


      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">

        <p className="text-xs font-semibold text-gray-400 uppercase px-3 mb-3">
          Main Menu
        </p>


        {menuItems.map((item, index) => (

          <button
            key={index}
            className={`
              group relative w-full flex items-center gap-4 
              px-4 py-3.5 rounded-xl text-left
              transition-all duration-300
              
              ${
                index === 0
                  ? "bg-pink-100 text-pink-600 shadow-sm"
                  : "text-gray-600 hover:bg-pink-50 hover:text-pink-600"
              }
            `}
          >

            {/* Active Indicator */}
            {index === 0 && (
              <span className="absolute left-0 w-1 h-8 bg-pink-500 rounded-r-full"></span>
            )}


            <span 
              className={`
                w-9 h-9 flex items-center justify-center 
                rounded-lg text-lg transition
                ${
                  index === 0
                    ? "bg-pink-200"
                    : "bg-gray-100 group-hover:bg-pink-100"
                }
              `}
            >
              {item.icon}
            </span>


            <span className="font-medium">
              {item.name}
            </span>


          </button>

        ))}

      </nav>



      {/* Doctor Profile */}
      <div className="p-4 border-t border-gray-100">

        <div className="
          flex items-center gap-3 
          p-4 rounded-2xl 
          bg-linear-to-r from-pink-50 to-rose-50
          border border-pink-100
        ">

          <div className="
            w-12 h-12 rounded-full 
            bg-pink-500 text-white
            flex items-center justify-center
            font-bold shadow-md
          ">
            DR
          </div>


          <div className="flex-1">

            <h3 className="text-sm font-bold text-gray-800">
              Dr. Maria Santos
            </h3>

            <p className="text-xs text-gray-500">
              OB-GYN Specialist
            </p>

          </div>


          <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>

        </div>



        <button
          className="
            mt-3 w-full py-3 rounded-xl
            text-red-500 font-medium
            bg-red-50
            hover:bg-red-100
            transition
          "
        >
          🚪 Logout
        </button>


      </div>

    </aside>
  );
}

export default Sidebar;