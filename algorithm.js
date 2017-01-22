var algorithm = function() {
    var self = this;

    self.calculateScalingFactor = function(age, active, stress) {
        var scaling_factor = 1;

        if (age >= 0 && age <= 7) {
            scaling_factor *= 12/8;
        } else if (age > 7 && age <= 13) {
            scaling_factor *= 9.5/8;
        } else if (age > 13 && age <= 18) {
            scaling_factor *= 9/8;
        } 

        switch(active) {
            case '3': 
                scaling_factor *= 1.021;
                break;
            case '4':
                scaling_factor *= 1.0625;
                break;
            case '5':
                scaling_factor *= 1.125;
                break; 
        }   

        switch(stress) {
            case '3': 
                scaling_factor *= 1.021;
                break;
            case '4':
                scaling_factor *= 1.0625;
                break;
            case '5':
                scaling_factor *= 1.125;
                break; 
        };

        return scaling_factor;
    };

    self.roundToNearestHalf = function(n) {
        return 0.5 * Math.floor(n * 2.0 + 0.5);
    };
}; 

module.exports = algorithm;