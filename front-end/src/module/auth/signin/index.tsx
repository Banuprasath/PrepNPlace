import { useForm, SubmitHandler } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type Inputs = {
    name: string
    RegNo:number,
    password: string,
    confirmPassword:string,
    email:string

  }


export default function SignUp(){

const {
        register,
        handleSubmit,
        formState: { errors },
      } = useForm<Inputs>()
      const onSubmit: SubmitHandler<Inputs> = (data) => console.log(data)
    return(<>

  
<div className=" md:w-3/6 lg:w-2/6 flex flex-col justify-center shadow-2xl lg:p-6 p-3 h-full bg-gradient-to-r from-black to-[#2B2B2B] rounded-lg">
    <h1 className="text-white text-3xl text-center">SIGN UP</h1>
      
         <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col lg:mx-6 lg:px-4">
      <Label className="text-lg  text-white " htmlFor="RegNo">Register number </Label>
      <Input className="m-2  mx-2 bg-white"  {...register("RegNo", { required: true })} />
      {errors.RegNo && <span className="text-red-400">This field is required</span>}
      
      <Label className="text-lg text-white" htmlFor="name">Name</Label>
      <Input className="m-2  mx-2 bg-white" {...register("name", { required: true })} />
      {errors.password && <span className="text-red-400">This field is required</span>}

      <Label className="text-lg text-white" htmlFor="email">Email</Label>
      <Input className="m-2  mx-2 bg-white" {...register("email", { required: true })}  type="email"/>
      {errors.password && <span className="text-red-400">This field is required</span>}

      <Label className="text-lg text-white" htmlFor="password">Password</Label>
      <Input className="m-2 mx-2 bg-white" {...register("password", { required: true })} type="password" />
      {errors.password && <span className="text-red-400">This field is required</span>}

      <Label className="text-lg text-white" htmlFor="confirmPassword">Confirm Password</Label>
      <Input className="m-2 mx-2 bg-white" {...register("confirmPassword", { required: true })} type="password"/>
      {errors.password && <span className="text-red-400">This field is required</span>}
<div className="flex justify-center">
<Button className="my-2 w-40" type="submit" variant="forest"> submit</Button>

</div>
    </form>
    
   

        
</div>

    
    </>)

}