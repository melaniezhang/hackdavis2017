var express          = require('express'),
	app              = express(),
	bodyParser       = require('body-parser'),
	path             = require('path'),
	algorithm        = require("./algorithm.js"),
	Algorithm        = new algorithm();

var calendar = initializeCalendar();
var wakeupTime;
var hoursAsleep;
var userName;

/* Uses the views directory as the default */
app.use(express.static('views'));

/* Uses the public directory as the default directory name */
app.use(express.static(__dirname + '/public'));

/* Parses the body of the HTML */
app.use(bodyParser.urlencoded({extended: true}));

/* Sets up the view engine and makes the extension 'ejs' */
app.set("view engine", "ejs");

/* GET REQUESTS */
app.get("/", function(req, res){
	res.redirect("/sleep");
});

app.get("/sleep", function(req, res) {
	res.render("sleep");
});

/* POST REQUESTS */

app.post("/sleep_results", function(req, res) {
	userName = req.body.name;
	var hours = req.body.hours;
	var age = req.body.age;
	var active = req.body.active;
	var stress = req.body.stress;
	var scaling_factor = Algorithm.calculateScalingFactor(age, active, stress);
	var ideal_sleep = Algorithm.roundToNearestHalf(8 * scaling_factor);
	var difference = Math.abs(ideal_sleep - hours);
	var change_diff = (difference / 5.0 * (difference / 2.0));
	var suggested_sleep = Algorithm.roundToNearestHalf(Number(hours) + change_diff);
	var sleep_result = {
		ideal: ideal_sleep,
		suggested: suggested_sleep
	};

	res.render("sleep_results", {sleep_result: sleep_result});
});

app.post("/schedule", function(req, res) {
	wakeupTime = req.body.wakeup;
	hoursAsleep = req.body.changed_hours;
	calendar1 = calendar;
	markOffSleeping(wakeupTime, hoursAsleep);
	
	res.render("schedule");
});

app.post("/tasks", function (req, res) {

	var fixedTaskTimes = Object.keys(req.body).sort();

	if (fixedTaskTimes.length != 0) {
		// convert checkbox name (time) to calendar index
		fixedTaskTimes.forEach(function(time) {
			var minutes_index;

			if (time.length == 3) {
				minutes_index = parseInt(time[2]);
			} else if (time.length == 4) {
				minutes_index =parseInt(time[2]) * 10 + parseInt(time[3]);
			} else {
				console.log("error!!");
			}
			var index = parseInt(time[0]) * 24 * 4 + parseInt(minutes_index);
			calendar[parseInt(index)].occupied = true;
		});
	}

	res.render("tasks");
});

app.post("/results", function(req, res) {
	var variable_tasks = req.body;
	var keys = Object.keys(variable_tasks);
	var variable_tasks_array = [];

	for (var i = 0; i < keys.length; i += 3) {
		var object = {
			task_name: variable_tasks[keys[i]],
			time: variable_tasks[keys[i+1]],
			due_date: variable_tasks[keys[i+2]]
		}

		variable_tasks_array.push(object);
	}

	variable_tasks_array.sort(compare);
	console.log(variable_tasks_array);

	/* insert each task with largest first*/
	for (var i = 0; i < variable_tasks_array.length; i++) {
		// parse due_date
		var year = parseInt(variable_tasks_array[i].due_date.split('-')[0]);
		var month = parseInt(variable_tasks_array[i].due_date.split('-')[1]) - 1;
		var day = parseInt(variable_tasks_array[i].due_date.split('-')[2]);
		var date = new Date(year, month, day);

		// get day from day of week
		var due_date = date.getDay();
		var DoW_index = (parseInt(due_date) + 1) * 24 * 4; // due end of day

		/* inserting algorithms */
		// make gap array
		var gaps = [];
		getGaps(gaps);
		
		// stuff it in days with much free time of days with 
		var free_time_arr = []; // contains free time sums for each day

		// calculate total free (gap sum) time for each day
		for (var x = 0; x < 7; x++){
			var day_sum = 0;

			gaps[x].forEach(function(gap){
				day_sum += parseInt(gap[1]);
			});

			var obj = {
				dow: x,
				gap_sum: day_sum
			}

			free_time_arr.push(obj);
		}

		free_time_arr.sort(compareGapSums);


		var HAS_INSERTED = false;

		for (var z = 0; z < free_time_arr.length; z++) {
			if (HAS_INSERTED) {
				break;
			}

			var gapSumDow = free_time_arr[z].dow;
			var chosen_dow;

			// choose which day to insert task into
			if (gapSumDow > due_date) {
				chosen_dow = due_date;
			} // use due date
			else {
				chosen_dow = gapSumDow;
			} // use gapSumDow

			var desired_ind;// = skipBlocksInCol(gaps, chosen_dow);//, Math.floor((-0)*Math.random()) + 1));

/*			for (desired_ind = chosen_dow * 24 * 4; 
				 (!calendar[desired_ind].occupied ||
				 calendar[desired_ind].asleep);
				 desired_ind++)*/

			for (var k = (chosen_dow+1)*24*4; k >= 0; k--) {
				var num_of_blocks = variable_tasks_array[i].time / 15;

				if (blockFits(num_of_blocks, k)) {
					if (blockFits(num_of_blocks, k-1)) {
						insertVariableBlock(num_of_blocks, k-2, variable_tasks_array[i]);
						HAS_INSERTED = true;
						break;
					}
				}
			};
		};
	};

			// stuff it in the back
	/*		for (var i = DoW_index; i > 0; i--) {
				var num_of_blocks = task.time / 15;

				if (blockFits(num_of_blocks, i)) {
					insertBlock(num_of_blocks, i, task);
					break;
				}
			}*/
	console.log(calendar);
	res.render("results", {calendar: calendar, userName: userName});
});


/* Sets up server */
app.listen(3000, function(){
	console.log("The HackDavis server has started!");
});

/* functions!! */
function initializeCalendar() {
	var result = [];

	for (var DoW = 0; DoW < 7; DoW++) {
		for (var t = 0; t < 24 * 4; t++) {
			var timeslot = {
				name: "",
				time: DoW.toString() + "-" + t.toString(),
				duration: 0,
				due: "",
				occupied: false,
				asleep: false,
				variable: false
			}

			result.push(timeslot);
		}
	}
	return result;
};

function markOffSleeping(wakeupTime, hoursAsleep) {
	console.log(wakeupTime);
	console.log(hoursAsleep);

	var blocksAsleep = hoursAsleep * 4;
	var startingIndex = parseInt(parseInt(wakeupTime[0]) * 10 * 4 + parseInt(wakeupTime[1]) * 4 + (parseInt(wakeupTime[3]) * 10 + parseInt(wakeupTime[4])) % 15);
	console.log(startingIndex);

	for (var i = 0; i < 7; i++) {
		for (var t = 0; t < blocksAsleep; t++) {
			if (i * 24 * 4 + startingIndex - t >= 0) {
				calendar[i * 24 * 4 + startingIndex - t].asleep = true;
				calendar[i * 24 * 4 + startingIndex - t].occupied = true;
			} // index is in bounds
		}
	}
};

function compare(a, b) {
	if (a.time < b.time) {
		return 1;
	}
	if (a.time > b.time) {
		return -1;
	}
	return 0;
}

function compareGapSums(a, b) {
	if (a.gap_sum < b.gap_sum) {
		return 1;
	}
	if (a.gap_sum > b.gap_sum) {
		return -1;
	}
	return 0;
}

function blockFits(num, index) {
	for (var i = 1; i < num + 1; i++) {
		if (index - i <= 0){
			return false;
		}

		if (calendar[index - i].occupied == true || calendar[index - i].asleep == true)
		{
			return false;
		}
	}

	return true;
}

function insertBlock(num, index, task) {
	for (var i = 1; i < num + 1; i++) {
		calendar[index - i].name = task.task_name;
		calendar[index - i].duration = task.time;
		calendar[index - i].due = task.due_date;
		calendar[index - i].occupied = true;
	}
}

function insertVariableBlock(num, index, task) {
	for (var i = 1; i < num + 1; i++) {
		calendar[index - i].name = task.task_name;
		calendar[index - i].duration = task.time;
		calendar[index - i].due = task.due_date;
		calendar[index - i].occupied = true;
		calendar[index - i].variable = true;
	}
}

function getGaps(gaps) {
	for (var day = 0; day < 7; day++) {
		var day_gap = [];
		var gap_length = 0;
		var start_index = day * 24 * 4;

		for (var j = start_index; j < (day + 1) * 24 * 4; j++) {
			if (j % (24 * 4) != 0 &&
				(!calendar[j].occupied &&
			    calendar[j-1].occupied)) 
			{
				gap_length = 0;
				start_index = j;
			}

			if (j % (24 * 4) != 0 &&
				(calendar[j].occupied && 
				!calendar[j-1].occupied)) 
			{
				var gap = [start_index, gap_length];
				day_gap.push(gap);
				gap_length = 0;
			}

			if ((j % (24 * 4) == (24 * 4 - 1))) {
				var gap = [start_index, gap_length - 1];
				day_gap.push(gap);
			}

			gap_length++;
		};

		gaps.push(day_gap);
	}
}

// unused
function skipBlocksInCol(gaps, col) {
	var numOfGaps = gaps[col].length;
	var n = Math.floor((numOfGaps-0)*Math.random());
	var skippedBlocks = 0;
	var desired_index;

	for (desired_index = col * 24 * 4; skippedBlocks < n; desired_index++) {
		if (desired_index % 24 * 4 != 0) {
			if (calendar[desired_index].occupied && !calendar[desired_index-1].occupied) {
				skippedBlocks++;
			}
		}
	}

	return desired_index;
}