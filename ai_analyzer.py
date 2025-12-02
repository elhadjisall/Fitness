"""
AI Performance Analyzer for Jumping Jack Counter
Analyzes player performance and generates detailed reports with feedback.
"""

def generate_performance_report(performance_data):
    """
    Generate an AI-powered performance analysis report for both players.
    
    Args:
        performance_data: Dictionary containing performance metrics for both players
        
    Returns:
        Dictionary with detailed analysis and recommendations
    """
    p1 = performance_data['player1']
    p2 = performance_data['player2']
    game_duration = performance_data['game_duration']
    
    # Calculate performance scores (0-100)
    def calculate_performance_score(player_data, game_duration):
        """Calculate overall performance score based on multiple factors"""
        score = 0
        
        # Count score (40% weight) - more jumps = higher score
        # Target: 30-40 jumps per minute is excellent
        jumps_per_min = player_data['jumps_per_minute']
        if jumps_per_min >= 35:
            count_score = 40
        elif jumps_per_min >= 25:
            count_score = 35
        elif jumps_per_min >= 15:
            count_score = 25
        elif jumps_per_min >= 10:
            count_score = 15
        else:
            count_score = max(0, jumps_per_min * 1.5)
        score += count_score
        
        # Consistency score (30% weight)
        consistency = player_data['consistency']
        score += consistency * 0.3
        
        # Activity rate score (20% weight) - being in frame
        activity = player_data['activity_rate']
        if activity >= 80:
            activity_score = 20
        elif activity >= 60:
            activity_score = 15
        elif activity >= 40:
            activity_score = 10
        else:
            activity_score = activity * 0.2
        score += activity_score
        
        # Endurance score (10% weight) - maintaining pace
        if game_duration > 0:
            # Check if player maintained consistent pace throughout
            if player_data['count'] > 0 and consistency > 70:
                endurance_score = 10
            elif consistency > 50:
                endurance_score = 7
            else:
                endurance_score = 5
        else:
            endurance_score = 0
        score += endurance_score
        
        return min(100, max(0, score))
    
    p1_score = calculate_performance_score(p1, game_duration)
    p2_score = calculate_performance_score(p2, game_duration)
    
    # Generate feedback for each player
    def generate_player_feedback(player_data, player_num, score):
        """Generate personalized feedback for a player"""
        feedback = []
        strengths = []
        improvements = []
        
        # Analyze count
        jumps_per_min = player_data['jumps_per_minute']
        if jumps_per_min >= 35:
            strengths.append("Excellent jumping speed! You maintained a very fast pace.")
        elif jumps_per_min >= 25:
            strengths.append("Great jumping speed! You kept a good pace throughout.")
        elif jumps_per_min >= 15:
            feedback.append("Good effort! Try to increase your jumping speed for better results.")
        else:
            improvements.append("Try to increase your jumping speed. Aim for at least 15-20 jumps per minute.")
        
        # Analyze consistency
        consistency = player_data['consistency']
        if consistency >= 85:
            strengths.append("Outstanding consistency! Your rhythm was very steady.")
        elif consistency >= 70:
            strengths.append("Good consistency! You maintained a steady rhythm.")
        elif consistency >= 50:
            improvements.append("Work on maintaining a more consistent rhythm between jumps.")
        else:
            improvements.append("Try to keep a more steady pace. Consistency is key to improvement!")
        
        # Analyze activity
        activity = player_data['activity_rate']
        if activity < 50:
            improvements.append("Stay in the camera frame more consistently for better tracking.")
        
        # Overall assessment
        if score >= 85:
            overall = "🌟 Outstanding Performance! You're a jumping jack champion!"
        elif score >= 70:
            overall = "⭐ Great Job! You showed excellent effort and skill!"
        elif score >= 55:
            overall = "👍 Good Effort! Keep practicing to improve your score!"
        elif score >= 40:
            overall = "💪 Nice Try! With more practice, you'll get even better!"
        else:
            overall = "🎯 Keep Going! Every jump counts - practice makes perfect!"
        
        return {
            'overall': overall,
            'score': round(score, 1),
            'strengths': strengths if strengths else ["Keep up the great work!"],
            'improvements': improvements if improvements else ["You're doing great! Keep it up!"],
            'stats': {
                'total_jumps': player_data['count'],
                'jumps_per_minute': round(jumps_per_min, 1),
                'consistency': round(consistency, 1),
                'activity_rate': round(activity, 1)
            }
        }
    
    p1_feedback = generate_player_feedback(p1, 1, p1_score)
    p2_feedback = generate_player_feedback(p2, 2, p2_score)
    
    # Generate comparison and winner analysis
    winner = "Player 1" if p1['count'] > p2['count'] else "Player 2" if p2['count'] > p1['count'] else "Tie"
    
    comparison = []
    if p1['count'] > p2['count']:
        comparison.append(f"Player 1 completed {p1['count'] - p2['count']} more jumping jacks!")
    elif p2['count'] > p1['count']:
        comparison.append(f"Player 2 completed {p2['count'] - p1['count']} more jumping jacks!")
    else:
        comparison.append("Both players completed the same number of jumping jacks!")
    
    if p1['jumps_per_minute'] > p2['jumps_per_minute']:
        comparison.append(f"Player 1 had a faster pace ({p1_feedback['stats']['jumps_per_minute']} vs {p2_feedback['stats']['jumps_per_minute']} jumps/min).")
    elif p2['jumps_per_minute'] > p1['jumps_per_minute']:
        comparison.append(f"Player 2 had a faster pace ({p2_feedback['stats']['jumps_per_minute']} vs {p1_feedback['stats']['jumps_per_minute']} jumps/min).")
    
    if p1_feedback['stats']['consistency'] > p2_feedback['stats']['consistency']:
        comparison.append(f"Player 1 showed better consistency ({p1_feedback['stats']['consistency']:.1f}% vs {p2_feedback['stats']['consistency']:.1f}%).")
    elif p2_feedback['stats']['consistency'] > p1_feedback['stats']['consistency']:
        comparison.append(f"Player 2 showed better consistency ({p2_feedback['stats']['consistency']:.1f}% vs {p1_feedback['stats']['consistency']:.1f}%).")
    
    # Generate overall game summary
    total_jumps = p1['count'] + p2['count']
    avg_jumps_per_min = (p1['jumps_per_minute'] + p2['jumps_per_minute']) / 2
    
    summary = f"Game Summary: Both players completed a total of {total_jumps} jumping jacks in {int(game_duration // 60)} minutes and {int(game_duration % 60)} seconds. "
    summary += f"Average pace: {avg_jumps_per_min:.1f} jumps per minute. "
    summary += f"{winner} wins with the highest count!"
    
    return {
        'summary': summary,
        'winner': winner,
        'comparison': comparison,
        'player1': p1_feedback,
        'player2': p2_feedback,
        'game_stats': {
            'duration_seconds': round(game_duration, 1),
            'total_jumps': total_jumps,
            'average_jumps_per_minute': round(avg_jumps_per_min, 1)
        }
    }


