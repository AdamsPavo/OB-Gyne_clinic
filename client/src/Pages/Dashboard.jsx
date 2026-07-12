import Sidebar from "../components/Sidebar";

export default function Dashboard() {

  const stats = [
    {
      title: "Total Patients",
      value: "1,245",
      icon: "👩‍⚕️",
      color: "bg-pink-100",
      trend: "+12%"
    },
    {
      title: "Today's Appointments",
      value: "18",
      icon: "📅",
      color: "bg-blue-100",
      trend: "+5%"
    },
    {
      title: "Prenatal Monitoring",
      value: "86",
      icon: "🤰",
      color: "bg-purple-100",
      trend: "+8%"
    },
    {
      title: "Monthly Revenue",
      value: "₱85,400",
      icon: "💰",
      color: "bg-green-100",
      trend: "+15%"
    }
  ];


  const appointments = [
    {
      name:"Maria Santos",
      service:"Prenatal Checkup",
      time:"9:00 AM",
      status:"Confirmed"
    },
    {
      name:"Ana Reyes",
      service:"Consultation",
      time:"10:30 AM",
      status:"Pending"
    },
    {
      name:"Liza Cruz",
      service:"Ultrasound",
      time:"2:00 PM",
      status:"Completed"
    }
  ];


  return (

<div className="flex min-h-screen bg-gray-50">

<Sidebar/>


<div className="flex-1">


{/* HEADER */}

<header className="
m-6
rounded-3xl
bg-linear-to-r from-pink-600 to-rose-400
text-white
p-8
flex
justify-between
items-center
shadow-lg
">


<div>

<h1 className="text-3xl font-bold">
Good Morning, Admin 👋
</h1>


<p className="mt-2 text-pink-100">
Manage your clinic operations efficiently today.
</p>


</div>


<div className="
bg-white/20
px-5
py-3
rounded-2xl
backdrop-blur
">

🩺 OB-GYN Admin

</div>


</header>





<main className="px-6 pb-8">



{/* STATISTICS */}


<div className="
grid
grid-cols-1
md:grid-cols-2
xl:grid-cols-4
gap-6
">


{
stats.map((item,index)=>(


<div
key={index}
className="
bg-white
rounded-3xl
p-6
shadow-sm
hover:shadow-xl
transition
duration-300
flex
justify-between
items-center
border
border-gray-100
">


<div>


<p className="text-gray-500 text-sm">
{item.title}
</p>


<h1 className="
text-4xl
font-bold
text-gray-800
mt-3
">
{item.value}
</h1>


<span className="
text-green-600
text-sm
font-semibold
">
↑ {item.trend}
</span>


</div>



<div className={`
${item.color}
w-16
h-16
rounded-2xl
flex
items-center
justify-center
text-3xl
`}>
{item.icon}
</div>



</div>


))
}


</div>







{/* QUICK ACTIONS */}


<section className="
mt-8
bg-white
rounded-3xl
p-6
shadow-sm
">


<h2 className="
text-xl
font-bold
mb-5
">
Quick Actions
</h2>



<div className="
grid
grid-cols-2
md:grid-cols-4
gap-5
">


{
[
["➕","Add Patient","bg-pink-600 text-white"],
["📅","Appointment","bg-blue-100 text-blue-700"],
["🩺","Consultation","bg-purple-100 text-purple-700"],
["📊","Reports","bg-green-100 text-green-700"]

].map((item,index)=>(

<button
key={index}
className={`
${item[2]}
rounded-2xl
p-5
font-semibold
hover:scale-105
transition
`}
>

<div className="text-2xl mb-2">
{item[0]}
</div>

{item[1]}

</button>


))

}


</div>


</section>







{/* LOWER CONTENT */}


<div className="
grid
xl:grid-cols-3
gap-6
mt-8
">





{/* APPOINTMENTS */}


<section className="
xl:col-span-2
bg-white
rounded-3xl
p-6
shadow-sm
">


<div className="
flex
justify-between
mb-6
">


<h2 className="text-xl font-bold">
Today's Appointments
</h2>


<button className="
text-pink-600
font-semibold
">
View All
</button>


</div>




<div className="space-y-4">


{
appointments.map((item,index)=>(


<div
key={index}
className="
flex
justify-between
items-center
p-5
rounded-2xl
bg-gray-50
hover:bg-pink-50
transition
">


<div className="flex gap-4 items-center">


<div className="
w-12
h-12
rounded-full
bg-pink-100
flex
items-center
justify-center
">
👩
</div>


<div>

<h3 className="font-bold">
{item.name}
</h3>

<p className="text-gray-500 text-sm">
{item.service}
</p>

</div>


</div>




<div className="text-right">


<p className="
font-bold
text-pink-600
">
{item.time}
</p>


<span className="
text-xs
px-3
py-1
rounded-full
bg-green-100
text-green-700
">
{item.status}
</span>


</div>


</div>


))

}


</div>


</section>







{/* PATIENT STATUS */}


<section className="
bg-white
rounded-3xl
p-6
shadow-sm
">


<h2 className="text-xl font-bold mb-6">
Patient Status
</h2>



<div className="space-y-6">


{
[
["Pregnant Patients",86,"bg-pink-500"],
["Follow-up Visits",24,"bg-blue-500"],
["Emergency Cases",3,"bg-red-500"]

].map((item,index)=>(


<div key={index}>


<div className="
flex
justify-between
mb-2
">

<p className="text-gray-500">
{item[0]}
</p>


<strong>
{item[1]}
</strong>

</div>



<div className="
h-3
bg-gray-100
rounded-full
overflow-hidden
">

<div
className={`
${item[2]}
h-full
rounded-full
`}
style={{
width:`${item[1]}%`
}}
>

</div>

</div>


</div>


))

}


</div>


</section>


</div>



</main>


</div>


</div>

  );
}