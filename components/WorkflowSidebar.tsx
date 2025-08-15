import React from 'react';
import { WorkflowStepValue } from '../types';
import { WORKFLOW_STEPS_CONFIG, ETHICAL_GUIDELINES } from '../constants.tsx'; // Updated extension

const WorkflowSidebar = ({ currentStep, completedSteps }) => {
  return (
    <aside className="w-80 bg-slate-800 p-6 space-y-8 h-full overflow-y-auto shadow-xl">
      <div>
        <h2 className="text-xl font-semibold text-sky-400 mb-4 border-b border-slate-700 pb-2 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon w-6 h-6 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 6.471 3H4.5A2.25 2.25 0 0 0 2.25 5.25v13.5A2.25 2.25 0 0 0 4.5 21h15a2.25 2.25 0 0 0 2.25-2.25V8.835c0-.985-.426-1.855-1.12-2.43L16.5 3.525V5.25a2.25 2.25 0 0 1-2.25 2.25h-2.559m-5.8 0A2.251 2.251 0 0 1 6.471 3H4.5" />
          </svg>
          Kroky Procesu
        </h2>
        <ul className="space-y-2">
          {WORKFLOW_STEPS_CONFIG.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = completedSteps.has(step.id) && step.id !== WorkflowStepValue.ERROR;
            const isError = step.id === WorkflowStepValue.ERROR && isActive;

            let itemClass = "flex items-center p-3 rounded-lg transition-all duration-200 ease-in-out ";
            if (isActive) {
              itemClass += "bg-sky-600 text-white shadow-md scale-105 ";
            } else if (isCompleted) {
              itemClass += "bg-green-700/50 text-green-300 ";
            } else {
              itemClass += "bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white ";
            }
            if(isError){
              itemClass = "flex items-center p-3 rounded-lg bg-red-600 text-white shadow-md scale-105 ";
            }

            return (
              <li key={step.id} className={itemClass}>
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold ${isActive || isCompleted ? 'text-white' : 'text-sky-400'}`}>
                  {isCompleted ? <CheckIcon /> : step.icon}
                </span>
                <span className="font-medium ml-3">{step.name}</span> {/* Ensured consistent margin for text next to icon */}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-amber-400 mb-4 border-b border-slate-700 pb-2 flex items-center">
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon w-6 h-6 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          {ETHICAL_GUIDELINES.title}
        </h2>
        <ul className="space-y-2 text-sm text-slate-400">
          {ETHICAL_GUIDELINES.points.map((point, index) => (
            <li key={index} className="flex items-start">
              <span className="text-amber-500 mr-2 mt-1">&#8227;</span> {/* Bullet point */}
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};


const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);


export default WorkflowSidebar;
