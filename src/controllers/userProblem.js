const {getLanguageById,submitBatch,submitToken} = require("../utils/problemUtility");
const Problem = require("../models/problem");
const User = require("../models/user");
const { Submission } = require("../models/Submission");

const createProblem = async (req,res)=>{

    const {title,description,difficulty,tags,
        visibleTestCases,hiddenTestCases,startCode,
        referenceSolution, problemCreator
    } = req.body;


    try{
       
      for(const {language,completeCode} of referenceSolution){

        const languageId = getLanguageById(language);
          
        // I am creating Batch submission
        const submissions = visibleTestCases.map((testcase)=>({
            source_code:completeCode,
            language_id: languageId,
            stdin: testcase.input,
            expected_output: testcase.output
        }));


        const submitResult = await submitBatch(submissions);


        // Add a safety check:
        if (!submitResult || !Array.isArray(submitResult)) {
            return res.status(500).send("Failed to get a valid response from the compiler API");
        }

        const resultToken = submitResult.map((value)=> value.token);

        
       const testResult = await submitToken(resultToken);

      //  console.log(testResult);

        for(const test of testResult){
            if(test.status_id!=3){
                return res.status(400).send("Reference solution does not pass all visible test cases");
            }
        }

      }


      // We can store it in our DB

    const userProblem =  await Problem.create({
        ...req.body,
        problemCreator: req.result._id
      });

      res.status(201).send("Problem Saved Successfully");
    }
    catch(err){
        res.status(400).send("Error: "+ err);
    }
}


const updateProblem = async ( req , res) =>
{
   const {id} = req.params ;

    const {title,description,difficulty,tags,
        visibleTestCases,hiddenTestCases,startCode,
        referenceSolution, problemCreator
    } = req.body;

   try{ 
        
        if(!id)
        {
            return res.status(400).send("Missing Id Field");
        }

        const DsaProblem = await Problem.findById(id);

        if(!DsaProblem)
            return res.status(404).send("Problem is not persent")


        for(const {language,completeCode} of referenceSolution){
         

        // source_code:
        // language_id:
        // stdin: 
        // expectedOutput:

        const languageId = getLanguageById(language);
          
        // I am creating Batch submission
        const submissions = visibleTestCases.map((testcase)=>({
            source_code:completeCode,
            language_id: languageId,
            stdin: testcase.input,
            expected_output: testcase.output
        }));


        const submitResult = await submitBatch(submissions);
        // console.log(submitResult);

        const resultToken = submitResult.map((value)=> value.token);

        // ["db54881d-bcf5-4c7b-a2e3-d33fe7e25de7","ecc52a9b-ea80-4a00-ad50-4ab6cc3bb2a1","1b35ec3b-5776-48ef-b646-d5522bdeb2cc"]
        
       const testResult = await submitToken(resultToken);

      //  console.log(testResult);

       for(const test of testResult){
        if(test.status_id!=3){
         return res.status(400).send("Error Occured");
        }
       }

      }

      const newProblem = await Problem.findByIdAndUpdate( id , {...req.body} , {runValidators:true , new:true} );

      
      res.status(200).send(newProblem);

   }
   catch(err){
     
    res.status(404).send("Error is " + err)

   }
   


}


const deleteProblem = async( req , res) =>
{
    const {id} = req.params ;

    try
    {
        if( !id)
        {
           return res.status(400).send("Missing Id Field");
        }

        const deletedProblem = await Problem.findByIdAndDelete(id);

        if(!deletedProblem)
        {
            res.status(404).send("problem is missing") ;
        }

        res.status(200).send("problem deleted successfully");

    }
    catch(err)
    {
       res.status(500).send("Error is " + err);
    }

}

const getProblemById = async( req , res) =>
{

    const {id} = req.params ;

    try{
     
        if(!id){
            return res.status(404).send("Missing Id Field");
        }
        

        // .select()---> we are selecting only the fields that a user can see 
        // otherwise user can see all details 
        const getProblem = await Problem.findById(id).select(' _id title description difficulty tags visibleTestCases  startCode');

        if(!getProblem)
        {
            return res.status(404).send("Problem is missing");
        }

        res.status(200).send(getProblem);

    }
    catch(err){
        res.status(500).send("Error is " + err);
    }
}

const getAllProblem = async(req , res )=>
{
      
    
    try{
     

        const allProblem = await Problem.find({}).select('_id title difficulty tags');

        if(!allProblem)
        {
            return res.status(404).send("Sorry there is no problems");
        }

        res.status(200).send(allProblem);

    }
    catch(err){
        res.status(500).send("Error is " + err);
    }



}

const solvedProblemsbyUser = async(req , res)=>
{
   
    try{
     
       const userId = req.result._id ;
       
       const user = await User.findById(userId).populate('problemSolved' , 'title difficulty tags ');  
    
    // const count = req.result.problemSolved.length ;

       res.status(200).send(user.problemSolved);
        
        


    }
    catch(err)
    {
        res.status(500).send("Internal Server Error"); 
    }

}

const submittedProblem = async(req , res)=>
{  
   
    try{

        const userId = req.result._id ;
        const problemId = req.params.pid ;

        const answer = await Submission.find({userId , problemId});

        if( answer.length == 0){
           res.status(200).send("No Submission yet")
        }

        res.status(200).send(answer);
    }
    catch(err){
        res.status(500).send("Internal Server Error");
    }

   
  


}







module.exports = {createProblem , updateProblem  , deleteProblem , getProblemById , getAllProblem ,solvedProblemsbyUser , submittedProblem } ;

