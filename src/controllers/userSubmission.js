const Problem = require("../models/problem");
const { Submission } = require("../models/Submission"); // Destructured based on your previous schema export!
const { getLanguageById, submitBatch, submitToken } = require("../utils/problemUtility");

const submitCode = async (req, res) => {
    try {
        // Note: Make sure your auth middleware sets req.result, otherwise this should be req.user
        const userId = req.result._id; 
        const problemId = req.params.id;
        const { code, language } = req.body;
        
        if (!userId || !code || !problemId || !language) {
            return res.status(400).send("Some field missing");
        }

        // 1. Fetch the problem & Protect against null
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).send("Problem not found in database");
        }

        // 2. Store the pending result
        const submittedResult = await Submission.create({
            userId,
            problemId,
            code,
            language,
            status: 'pending',
            testCasesTotal: problem.hiddenTestCases.length
        });

        // 3. Prepare Judge0 Submissions
        const languageId = getLanguageById(language);
        const submissions = problem.hiddenTestCases.map((testcase) => ({
            source_code: code,
            language_id: languageId,
            stdin: testcase.input,
            expected_output: testcase.output
        }));

        // 4. Send to Judge0 (Wrapped in try/catch in case of API limits!)
        let testResult;
        try {
            const submitResult = await submitBatch(submissions);
            const resultToken = submitResult.map((value) => value.token);
            testResult = await submitToken(resultToken);
        } catch (compilerError) {
            console.error("Judge0 API Error:", compilerError.message);
            submittedResult.status = 'error';
            submittedResult.errorMessage = "Compiler API failed or rate limit exceeded.";
            await submittedResult.save();
            return res.status(500).send("Compiler API Error. Submission saved as 'error'.");
        }

        // 5. Calculate Results
        let testCasesPassed = 0;
        let runtime = 0;
        let memory = 0;
        let status = 'accepted';
        let errorMessage = '';

        for (const test of testResult) {
            if (test.status_id == 3) { // Accepted
                testCasesPassed++;
                runtime += parseFloat(test.time || 0); 
                memory = Math.max(memory, test.memory || 0);
            } else {
                // If even one fails, the whole submission is wrong
                if (test.status_id == 4) {
                    status = 'wrong'; // Fixed: Matches your Schema Enum!
                    errorMessage = test.stderr || "Wrong Answer";
                } else {
                    status = 'error';  // Fixed: Matches your Schema Enum!
                    errorMessage = test.stderr || test.compile_output || "Compilation/Runtime Error";
                }
            }
        }

        // 6. Update Database
        submittedResult.status = status;
        submittedResult.testCasesPassed = testCasesPassed; // Fixed: Capital P!
        submittedResult.errorMessage = errorMessage;
        submittedResult.runtime = runtime;
        submittedResult.memory = memory;

        await submittedResult.save();

        // Send final result back to the frontend
        // problemId ko inser karenge userSchema ke problem  if it is not present there 
        
        if(!req.result.problemSolved.includes(problemId))
        {
            req.result.problemSolved.push(problemId);
            await req.result.save();
        }


        res.status(200).send(submittedResult);

    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error: " + err.message);
    }
}

const runCode = async (req, res) => {
    try {
        const userId = req.result._id; 
        const problemId = req.params.id;
        const { code, language } = req.body;
        
        if (!userId || !code || !problemId || !language) {
            return res.status(400).send("Some field missing");
        }

        // 1. Fetch the problem & Protect against null
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).send("Problem not found in database");
        }

        const languageId = getLanguageById(language);

        // 2. Map the VISIBLE test cases
        const submissions = problem.visibleTestCases.map((testcase) => ({
            source_code: code,
            language_id: languageId,
            stdin: testcase.input,
            expected_output: testcase.output
        }));

        // 3. Send to Judge0 (with our safety net!)
        let testResult;
        try {
            const submitResult = await submitBatch(submissions);
            const resultToken = submitResult.map((value) => value.token);
            testResult = await submitToken(resultToken);
        } catch (compilerError) {
            console.error("Judge0 API Error:", compilerError.message);
            return res.status(500).send("Compiler API failed. Please try again later.");
        }

        // 4. Send the raw array back to the frontend for rendering
        res.status(200).send(testResult);

    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error: " + err.message);
    }
}



module.exports = {submitCode , runCode };