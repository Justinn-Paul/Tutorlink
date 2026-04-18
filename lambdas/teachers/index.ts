import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

type TeacherProfile = {
  teacherId: string;
  name: string;
  subjects: string[];
  location: string;
  hourlyRate: number;
  rating: number;
};

const TEACHERS: TeacherProfile[] = [
  {
    teacherId: "t-001",
    name: "Sarah Tan",
    subjects: ["Primary Maths", "Primary Science"],
    location: "Tampines",
    hourlyRate: 45,
    rating: 4.8,
  },
  {
    teacherId: "t-002",
    name: "Marcus Lim",
    subjects: ["Secondary English", "GP"],
    location: "Bishan",
    hourlyRate: 60,
    rating: 4.6,
  },
  {
    teacherId: "t-003",
    name: "Priya Nair",
    subjects: ["JC Chemistry", "JC Biology"],
    location: "Clementi",
    hourlyRate: 75,
    rating: 4.9,
  },
];

// Accepts an APIGatewayProxyEvent from API Gateway.
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Incoming event:", JSON.stringify(event));

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teachers: TEACHERS,
      count: TEACHERS.length,
    }),
  };
};
