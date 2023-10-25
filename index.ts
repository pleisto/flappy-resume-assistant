import {
  createFlappyAgent,
  createInvokeFunction,
  createSynthesizedFunction,
  z,
  ChatGPT,
} from "@pleisto/node-flappy";
import OpenAI from "openai";
import fs from "fs";

const gpt35 = new ChatGPT(
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_API_BASE!,
  }),
  "gpt-3.5-turbo"
);

const resumeMetaType = z.object({
  name: z.string(),
  profession: z.string(),
  experienceYears: z.number(),
  skills: z.array(
    z.object({
      name: z.string(),
    })
  ),
  education: z.object({
    degree: z.string(),
    fieldOfStudy: z.string(),
    university: z.string(),
    year: z.number(),
  }),
});

const getMetaFromOneResume = createSynthesizedFunction({
  name: "getMeta",
  description: "Extract meta data from a resume full text.",
  args: z.object({
    resume: z.string().describe("Resume full text."),
  }),
  returnType: resumeMetaType,
});

const getResumes = createInvokeFunction({
  name: "getResumes",
  description: "Get all resumes.",
  args: z.null(),
  returnType: z.array(z.string()),
  resolve: async () => {
    const dirPath = "./data";
    return fs
      .readdirSync(dirPath)
      .map((filename) =>
        fs.readFileSync(`${dirPath}/${filename}`, "utf-8").toString()
      );
  },
});

interface ResumeMeta {
  name: string;
  profession: string;
  experienceYears: number;
  skills: Array<{ name: string }>;
  education: {
    degree: string;
    fieldOfStudy: string;
    university: string;
    year: number;
  };
}

const mapResumesToMeta = createInvokeFunction({
  name: "mapResumesToMeta",
  args: z.object({
    resumes: z.array(z.string().describe("resume full text list")),
  }),
  returnType: z.array(
    z.object({
      name: z.string(),
      profession: z.string(),
      experienceYears: z.number(),
      skills: z.array(
        z.object({
          name: z.string(),
        })
      ),
      education: z.object({
        degree: z.string(),
        fieldOfStudy: z.string(),
        university: z.string(),
        year: z.number(),
      }),
    })
  ),
  async resolve({ resumes }) {
    const data: Array<ResumeMeta> = [];
    for (const resume of resumes) {
      data.push(await getMetaFromOneResume.call(resumeAssistant, { resume }));
    }

    return data;
  },
});

const filterResumeMetaOverExperienceYears = createInvokeFunction({
  name: "filterResumeMetaOverExperienceYears",
  args: z.object({
    resumes: z.array(resumeMetaType),
    years: z.number(),
  }),
  returnType: z.array(resumeMetaType),
  resolve: async ({ resumes, years }) =>
    resumes.filter((r: ResumeMeta) => r.experienceYears > years),
});

const resumeAssistant = createFlappyAgent({
  llm: gpt35,
  functions: [
    getResumes,
    getMetaFromOneResume,
    mapResumesToMeta,
    filterResumeMetaOverExperienceYears,
  ],
});

async function run() {
  const result = await resumeAssistant.executePlan(
    "Retrieve metadata of resumes with more than 7 years of work experience."
  );

  console.log("Result:", result);
}

void run();
