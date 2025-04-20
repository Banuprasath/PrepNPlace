import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./components/ui/card";
type Student = {
    name: string;
    userRole: string;
    companyName: string;
    academicYear: string;
  };
  

export default function CheckComponent(props:Student){
    const{name,userRole,companyName,academicYear}=props;
    return(

        <>
{/* -gradient-to-r from-[#606c38] to-[#d4e09b] */}
<Card className="bg-gradient-to-r from-black to-[#2B2B2B]">
  <CardHeader>
    <CardTitle className="text-white text-xl"> {name}</CardTitle>
    <CardDescription className="text-white font-semibold">{userRole}</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="font-semibold text-white text-lg">{companyName}</p>
    <p className="text-white">{academicYear}</p>
  </CardContent>
  <CardFooter className="flex justify-end">
    <Button  variant="forest">View</Button>
  </CardFooter>
</Card>

        </>
    )
}