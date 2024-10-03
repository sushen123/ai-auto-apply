
import { PrismaClient } from "@prisma/client";


type ConnectionOject = {
    isConnected?: number
}

const  connection: ConnectionOject = {}
let prisma: PrismaClient

async function  dbConnect(): Promise<PrismaClient> {
    if(connection.isConnected) {
        console.log("Already connected to datbase")
        return prisma
    }

    try{
        prisma = new PrismaClient();
        await prisma.$connect()
        connection.isConnected=1;
        console.log("Connected to the database")
         return prisma

    } catch (error) {
        console.error("Failed to connect to the database" , error)
        process.exit(1)
    }
    
}

export {prisma, dbConnect}