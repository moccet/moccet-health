const fs = require('fs');
const path = require('path');

const files = [
  '01_weight_training_upper.json',
  '02_weight_training_lower.json',
  '03_hiit_cardio.json',
  '04_yoga.json',
  '05_pilates.json',
  '06_calisthenics.json',
  '07_crossfit.json',
  '08_running.json'
];

let allExercises = [];
let categoryCounts = {};

files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const exercises = data.exercises || [];
  categoryCounts[data.category] = exercises.length;
  allExercises = allExercises.concat(exercises);
});

const master = {
  metadata: {
    total_exercises: allExercises.length,
    categories: categoryCounts,
    generated_at: new Date().toISOString()
  },
  exercises: allExercises
};

fs.writeFileSync('exercises_master.json', JSON.stringify(master, null, 2));

console.log('Master file created successfully!');
console.log('Total exercises:', allExercises.length);
console.log('By category:', categoryCounts);
