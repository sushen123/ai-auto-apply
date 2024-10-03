'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Rocket, Briefcase, Calendar, Globe, ChevronDown, ChevronUp, GraduationCap } from 'lucide-react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from '@/hooks/use-toast'

// Types
interface WorkExperience {
  title: string;
  company: string;
  city: string;
  description: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

interface Education {
  school: string;
  degree: string;
  city: string;
  major: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

interface JobProfile {
  id: number;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  workAddress: string;
  linkedIn: string | null;
  desiredJobTitle: string;
  jobType: string;
  workLocation: string;
  willingToRelocate: boolean;
  salaryRange: string;
  availability: string;
  currentEmploymentStatus: string;
  yearsOfExperience: number;
  highestEducation: string;
  fieldOfStudy: string;
  graduationYear: number;
  primarySkills: string;
  languages: string;
  resume: string | null;
  coverLetter: string | null;
  personalStatement: string | null;
  heardAboutUs: string | null;
  isDeleted: boolean;
  workExperiences: WorkExperience[];
  educations: Education[];
}

interface JobBoards {
  [key: string]: {
    enabled: boolean;
    limit: number;
  };
}

interface JobFilters {
  experienceLevel: string;
  jobType: string[];
  datePosted: string;
  remotePreference: string;
  industry: string[];
}

enum MessageType {
  START_AUTO_APPLYING = 'START_AUTO_APPLYING',
}

// Configuration
const CONFIG = {
  DEFAULT_JOB_BOARDS: ['linkedin', 'indeed'],
  ALL_JOB_BOARDS: ['linkedin', 'indeed', 'glassdoor', 'monster'],
  EXPERIENCE_LEVELS: ['Entry Level', 'Associate', 'Mid-Senior Level', 'Director', 'Executive'],
  JOB_TYPES: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Volunteer', 'Apprenticeship'],
  DATE_POSTED: ['Past 24 hours', 'Past week', 'Past month', 'Any time'],
  REMOTE_PREFERENCES: ['On-site', 'Remote', 'Hybrid'],
  INDUSTRIES: ['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Hospitality', 'Media', 'Government'],
};

// Mock job profiles data with work experiences and education
const mockJobProfiles: JobProfile[] = [
  {
    id: 1,
    userId: "user1",
    fullName: "Sushen Oli",
    email: "sushensame@gmail.com",
    phone: "9848085163",
    address: "123 Main St, Anytown, USA",
    workAddress: "USA",
    linkedIn: "https://linkedin.com/in/sushen123",
    desiredJobTitle: "Software Engineer",
    jobType: "Full-time",
    workLocation: "Remote",
    willingToRelocate: true,
    salaryRange: "$80,000 - $120,000",
    availability: "Immediately",
    currentEmploymentStatus: "Employed",
    yearsOfExperience: 5,
    highestEducation: "Bachelor's Degree",
    fieldOfStudy: "Computer Science",
    graduationYear: 2018,
    primarySkills: "JavaScript, React, Node.js, Python",
    languages: "English, Spanish",
    resume: "sushen.pdf",
    coverLetter: "",
    personalStatement: "Passionate software engineer with a focus on web technologies...",
    heardAboutUs: "LinkedIn",
    isDeleted: false,
    workExperiences: [
      {
        title: "Software Engineer",
        company: "Your Journey",
        city: "America",
        description: "Developed and maintained web applications using modern JavaScript frameworks.",
        startDate: "01/2021",
        endDate: "present",
        current: true
      },
      {
        title: "Junior Developer",
        company: "Tech Innovations",
        city: "Silicon Valley",
        description: "Assisted in the development of mobile applications and performed code reviews.",
        startDate: "06/2019",
        endDate: "12/2020",
        current: false
      }
    ],
    educations: [
      {
        school: "Tribhuwan",
        degree: "BIT",
        city: "America",
        major: "Science and Technology",
        startDate: "01/2021",
        endDate: "present",
        current: true
      },
      {
        school: "BVM",
        degree: "Nepal",
        city: "Banke",
        major: "Science and technlogy",
        startDate: "06/2019",
        endDate: "12/2020",
        current: false
      }
    ]
  },
  {
    id: 2,
    userId: "user2",
    fullName: "Sushen Oli",
    email: "sushensame@gmail.com",
    phone: "987-654-3210",
    address: "789 Oak Rd, Another City, USA",
    workAddress: "101 Business Blvd, Corporatetown, USA",
    linkedIn: "https://linkedin.com/in/sushen123",
    desiredJobTitle: "Data Scientist",
    jobType: "Contract",
    workLocation: "Hybrid",
    willingToRelocate: false,
    salaryRange: "$100,000 - $150,000",
    availability: "2 weeks notice",
    currentEmploymentStatus: "Unemployed",
    yearsOfExperience: 3,
    highestEducation: "Master's Degree",
    fieldOfStudy: "Data Science",
    graduationYear: 2020,
    primarySkills: "Python, R, Machine Learning, SQL",
    languages: "English, Mandarin",
    resume: "sushen.pdf", // name of the pdf you uploaded
    coverLetter: "",
    personalStatement: "Data scientist with a strong background in statistical analysis...",
    heardAboutUs: "Friend referral",
    isDeleted: false,
    workExperiences: [
      {
        title: "Software Engineer",
        company: "Your Journey",
        city: "America",
       
        description: "Developed and maintained web applications using modern JavaScript frameworks.",
        startDate: "01/2021",
        endDate: "present",
        current: true
      },
      {
        title: "Junior Developer",
        company: "Tech Innovations",
        city: "Silicon Valley",
        description: "Assisted in the development of mobile applications and performed code reviews.",
        startDate: "06/2019",
        endDate: "12/2020",
        current: false
      }
    ],
    educations: [
      {
        school: "Tribhuwan",
        degree: "BIT",
        city: "Nepalgunj",
        major: "Science and Technology",
        startDate: "01/2021",
        endDate: "present",
        current: true
      },
      {
        school: "BVM",
        degree: "High School",
        city: "Banke",
        major: "Science and technlogy",
        startDate: "06/2019",
        endDate: "12/2020",
        current: false
      }
    ]
  },
];

const AutoApply: React.FC = () => {
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [showAllJobBoards, setShowAllJobBoards] = useState(false);
  const [jobBoards, setJobBoards] = useState<JobBoards>(
    Object.fromEntries(CONFIG.ALL_JOB_BOARDS.map(board => [board, { enabled: false, limit: 0 }]))
  );
  const [userLimit, setUserLimit] = useState(10);
  const [jobFilters, setJobFilters] = useState<JobFilters>({
    experienceLevel: '',
    jobType: [],
    datePosted: '',
    remotePreference: '',
    industry: [],
  });
  const [tailorResume, setTailorResume] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    setJobProfiles(mockJobProfiles);
  }, []);

  const toggleJobBoard = useCallback((board: string) => {
    setJobBoards(prev => ({
      ...prev,
      [board]: { ...prev[board], enabled: !prev[board].enabled }
    }));
  }, []);

  const updateJobBoardLimit = useCallback((board: string, limit: number) => {
    setJobBoards(prev => {
      const newBoards = { ...prev };
      newBoards[board].limit = limit;
      return newBoards;
    });
  }, []);

  const getTotalLimit = useCallback(() => {
    return Object.values(jobBoards).reduce((total, board) => total + board.limit, 0);
  }, [jobBoards]);

  const startAutoApplying = useCallback(() => {
    if (!selectedProfileId) {
      toast({
        title: "Job Profile Required",
        description: "Please select a job profile before starting the auto-apply process.",
        duration: 2000,
        variant: 'destructive'
      });
      return;
    }

    const totalLimit = getTotalLimit();
    if (totalLimit > userLimit) {
      toast({
        title: "Limit Exceeded",
        description: `Your total limit (${totalLimit}) exceeds your available limit (${userLimit}). Please adjust your limits.`,
        duration: 2000,
        variant: 'destructive'
      });
      return;
    }

    if (totalLimit === 0) {
      toast({
        title: "No Application Limit Set",
        description: "Please set a limit for the number of applications before starting the auto-apply process.",
        duration: 2000,
        variant: 'destructive'
      });
      return;
    }

    const isAnyJobBoardEnabled = Object.values(jobBoards).some(board => board.enabled);

    if (!isAnyJobBoardEnabled) {
      toast({
        title: "No Job Boards Enabled",
        description: "Please enable at least one job board to start the auto-apply process.",
        duration: 3000,
        variant: 'destructive'
      });
      return;
    }

    const updatedJobBoards = Object.fromEntries(
      Object.entries(jobBoards).map(([key, board]) => [
        key,
        {
          ...board,
          enabled: board.limit > 0 ? board.enabled : false
        }
      ])
    );

    const selectedProfile = jobProfiles.find(profile => profile.id.toString() === selectedProfileId);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: MessageType.START_AUTO_APPLYING,
        updatedJobBoards,
        job: selectedProfile,
        jobFilters,
        tailorResume
      }, (response) => {
        if (response && response.success) {
          toast({
            title: "Auto-applying Started",
            description: "We're now applying to jobs for you!",
            duration: 3000
          });
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        } else {
          console.log(response);
          toast({
            title: "Failed to Start",
            description: "There was an error starting the auto-apply process.",
            duration: 3000,
            variant: 'destructive'
          });
        }
      });
    } else {
      console.log('Starting auto-apply with:', { updatedJobBoards, selectedProfile, jobFilters, tailorResume });
      toast({
        title: "Auto-applying Started",
        description: "We're now applying to jobs for you!",
        duration: 3000
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [jobBoards, selectedProfileId, jobFilters, toast, userLimit, getTotalLimit, tailorResume, jobProfiles]);

  const visibleJobBoards = showAllJobBoards ? CONFIG.ALL_JOB_BOARDS : CONFIG.DEFAULT_JOB_BOARDS;

  return (
    <TooltipProvider>
      <div className="w-96 max-w-md p-4 bg-white rounded-xl shadow-2xl">
        <h2 className="text-2xl font-bold mb-4 text-center text-blue-800">AutoApply.Jobs</h2>
        <div className="mb-4 text-sm text-center">
          Available Applications: <span className="font-bold text-blue-600">{userLimit - getTotalLimit()}</span> / {userLimit}
        </div>
        <Tabs defaultValue="job-profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="job-profile" className="text-sm">Job Profile</TabsTrigger>
            <TabsTrigger value="job-boards" className="text-sm">Job Boards</TabsTrigger>
            <TabsTrigger value="filters" className="text-sm">Filters</TabsTrigger>
          </TabsList>
          <TabsContent value="job-profile">
            <Card>
              <CardContent className="pt-4">
                <Label htmlFor="jobProfile" className="text-sm">Select Job Profile</Label>
                <Select onValueChange={setSelectedProfileId} value={selectedProfileId}>
                  <SelectTrigger id="jobProfile" className="text-sm">
                    <SelectValue placeholder="Select a job profile" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {jobProfiles.map((profile) => (
                      <SelectItem
                        key={profile.id}
                        value={profile.id.toString()}
                        className="text-sm"
                      >
                        {profile.desiredJobTitle} - {profile.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardContent className="pt-4">
                <Label htmlFor="tailorResume" className="text-sm flex items-center space-x-2">
                  <Checkbox
                    id="tailorResume"
                    checked={tailorResume}
                    onCheckedChange={(checked) => setTailorResume(checked as boolean)}
                  />
                  <span>Tailor resume based on job description</span>
                </Label>
              </CardContent>
            </Card>
            {selectedProfileId && (
              <Card className="mt-4">
                <CardContent className="pt-4">
                  <h3 className="text-lg font-semibold mb-2">Profile Details</h3>
                  {jobProfiles.find(profile => profile.id.toString() === selectedProfileId)?.workExperiences.map((exp, index) => (
                    <div key={index} className="mb-2">
                      <h4 className="text-sm font-semibold">{exp.title} at {exp.company}</h4>
                      <p className="text-xs text-gray-600">{exp.startDate} - {exp.endDate}</p>
                      <p className="text-xs">{exp.description}</p>
                    </div>
                  ))}
                  {jobProfiles.find(profile => profile.id.toString() === selectedProfileId)?.educations.map((edu, index) => (
                    <div key={index} className="mb-2">
                      <h4 className="text-sm font-semibold">{edu.degree} in {edu.major}</h4>
                      <p className="text-xs text-gray-600">{edu.school}, {edu.city}</p>
                      <p className="text-xs">{edu.startDate} - {edu.endDate}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="job-boards">
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {visibleJobBoards.map((board) => (
                    <motion.div
                      key={board}
                      className="flex items-center justify-between p-2 bg-blue-50 rounded-lg"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Label htmlFor={board} className="text-sm capitalize cursor-pointer flex-1">{board}</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          value={jobBoards[board].limit}
                          onChange={(e) => updateJobBoardLimit(board, parseInt(e.target.value) || 0)}
                          className="w-16 text-sm"
                          min="0"
                          max={userLimit}
                        />
                        <Switch
                          id={board}
                          checked={jobBoards[board].enabled}
                          onCheckedChange={() => toggleJobBoard(board)}
                        />
                      </div>
                    </motion.div>
                  ))}
                  <Button
                    onClick={() => setShowAllJobBoards(prev => !prev)}
                    variant="outline"
                    className="w-full text-sm"
                  >
                    {showAllJobBoards ? (
                      <>
                        <ChevronUp className="mr-2 h-4 w-4" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-2 h-4 w-4" />
                        See More Job Boards
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="filters">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <FilterSection title="Experience Level" icon={<Briefcase className="h-4 w-4" />}>
                <Select
                  value={jobFilters.experienceLevel}
                  onValueChange={(value) => setJobFilters(prev => ({ ...prev, experienceLevel: value }))}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIG.EXPERIENCE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level} className="text-sm">{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              <FilterSection title="Job Type" icon={<Briefcase className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-2">
                  {CONFIG.JOB_TYPES.map((type) => (
                    <Label key={type} className="flex items-center space-x-2 text-sm">
                      <Checkbox
                        checked={jobFilters.jobType.includes(type)}
                        onCheckedChange={(checked) => {
                          setJobFilters(prev => ({
                            ...prev,
                            jobType: checked
                              ? [...prev.jobType, type]
                              : prev.jobType.filter(t => t !== type)
                          }))
                        }}
                      />
                      <span>{type}</span>
                    </Label>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Date Posted" icon={<Calendar className="h-4 w-4" />}>
                <Select
                  value={jobFilters.datePosted}
                  onValueChange={(value) => setJobFilters(prev => ({...prev, datePosted: value }))}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select date posted" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIG.DATE_POSTED.map((option) => (
                      <SelectItem key={option} value={option} className="text-sm">{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              <FilterSection title="Remote Preference" icon={<Globe className="h-4 w-4" />}>
                <RadioGroup
                  value={jobFilters.remotePreference}
                  onValueChange={(value) => setJobFilters(prev => ({ ...prev, remotePreference: value }))}
                >
                  {CONFIG.REMOTE_PREFERENCES.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={option} />
                      <Label htmlFor={option} className="text-sm">{option}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </FilterSection>

              <FilterSection title="Industry" icon={<Briefcase className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-2">
                  {CONFIG.INDUSTRIES.map((industry) => (
                    <Label key={industry} className="flex items-center space-x-2 text-sm">
                      <Checkbox
                        checked={jobFilters.industry.includes(industry)}
                        onCheckedChange={(checked) => {
                          setJobFilters(prev => ({
                            ...prev,
                            industry: checked
                              ? [...prev.industry, industry]
                              : prev.industry.filter(i => i !== industry)
                          }))
                        }}
                      />
                      <span>{industry}</span>
                    </Label>
                  ))}
                </div>
              </FilterSection>
            </div>
          </TabsContent>
        </Tabs>
        <div className="mt-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  onClick={startAutoApplying}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 text-sm"
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  Start AutoApplying
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {!selectedProfileId
                ? "Please select a job profile before starting"
                : getTotalLimit() > userLimit
                ? "Total limit exceeds available applications"
                : "Click to start auto-applying"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

const FilterSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <Card className="mb-2 border-blue-200">
    <CardContent className="p-3">
      <h3 className="text-sm font-semibold mb-2 flex items-center text-blue-700">
        {icon}
        <span className="ml-2">{title}</span>
      </h3>
      {children}
    </CardContent>
  </Card>
);

export default AutoApply;