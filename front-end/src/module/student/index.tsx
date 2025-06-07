import CheckComponent from "@/checkComponent";
import { useEffect } from "react";
// type Student = {
//     name: string;
//     userRole: string;
//     companyName: string;
//     academicYear: string;
//   };





const student = [
    {
        name: "Alice Johnson",
        userRole: "Student",
        companyName: "TechNova Inc",
        academicYear: "2022-2023",
    },
    {
        name: "Brian Smith",
        userRole: "Intern",
        companyName: "CodeCrafters",
        academicYear: "2021-2022",
    },
    {
        name: "Catherine Lee",
        userRole: "Trainee",
        companyName: "InnovateX",
        academicYear: "2023-2024",
    },
    {
        name: "Daniel Kim",
        userRole: "Graduate",
        companyName: "ByteLogic Ltd",
        academicYear: "2020-2021",
    },
    {
        name: "Emily Davis",
        userRole: "Student",
        companyName: "SoftSolutions",
        academicYear: "2022-2023",
    }
];


export default function StudentLayout() {

    useEffect(() => {
        fetch("http://localhost:3000/")
          .then((res) => res.json())
          .then((data) => console.log(data))
          .catch((err) => console.log(err));
      }, []);
    return (
        <>
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-4 p-4">
        {student.map((stu, index) => (
                <CheckComponent
                    key={index}
                    name={stu.name}
                    userRole={stu.userRole}
                    companyName={stu.companyName}
                    academicYear={stu.academicYear}
                />
            ))}

        </div>
          
        </>
    );
}