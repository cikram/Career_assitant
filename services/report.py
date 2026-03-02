import os
import shutil
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import math
import re
from datetime import datetime
from fpdf import FPDF, XPos, YPos


COLORS = {
    'primary': '#2C3E50',
    'accent': '#3498DB',
    'success': '#27AE60',
    'danger': '#E74C3C',
    'light_gray': '#F8F9F9',
    'mid_gray': '#7F8C8D',
    'dark_gray': '#34495E'
}


def hex_to_rgb(hex_code: str) -> tuple:
    """Convert hex color to RGB tuple for fpdf."""
    hex_code = hex_code.lstrip('#')
    return tuple(int(hex_code[i:i + 2], 16) for i in (0, 2, 4))


def generate_charts(data: dict, tmp_dir: str):
    """
    Generate charts for the PDF report.
    Returns paths to the generated chart images.
    """
    os.makedirs(tmp_dir, exist_ok=True)
    
    # 1. Donut Gauge for Overall Match Score
    overall_score = data['match_score'].get('overall', 0)
    
    fig, ax = plt.subplots(figsize=(4, 4), subplot_kw={'projection': 'polar'})
    ax.set_theta_offset(math.pi)
    ax.set_theta_direction(-1)

    colors = [COLORS['accent'], COLORS['light_gray']]
    values = [overall_score, 100 - overall_score]

    # Plot outer ring (background)
    ax.bar(0, 100, width=2*math.pi, bottom=1, color=COLORS['light_gray'], alpha=0.3)
    # Plot score
    ax.bar(0, overall_score, width=2*math.pi, bottom=1, color=COLORS['accent'])

    ax.set_axis_off()
    plt.text(0, 50, f'{overall_score}%', ha='center', va='center', 
             fontsize=28, fontweight='bold', color=COLORS['primary'])
    plt.text(0, 20, 'Match Score', ha='center', va='center', 
             fontsize=12, color=COLORS['mid_gray'])
    
    donut_path = os.path.join(tmp_dir, 'score_donut.png')
    plt.savefig(donut_path, transparent=True, bbox_inches='tight', dpi=300)
    plt.close()

    # 2. Tier Coverage Bar Chart
    bd = data['match_score'].get('breakdown', {})
    tiers = ['Required', 'Preferred', 'Nice To Have']
    scores = [
        bd.get('required', {}).get('tier_pct', 0),
        bd.get('preferred', {}).get('tier_pct', 0),
        bd.get('nice_to_have', {}).get('tier_pct', 0)
    ]
    
    fig, ax = plt.subplots(figsize=(6, 2.5))
    bars = ax.barh(tiers[::-1], scores[::-1], color=COLORS['accent'], height=0.6)
    
    for bar in bars:
        ax.text(bar.get_width() + 2, bar.get_y() + bar.get_height()/2, 
                f'{int(bar.get_width())}%', 
                va='center', fontweight='bold', color=COLORS['primary'])
        
    ax.set_xlim(0, 110)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.xaxis.set_visible(False)
    plt.title('Coverage by Importance Tier', color=COLORS['dark_gray'], pad=10)
    
    tier_bar_path = os.path.join(tmp_dir, 'tier_bars.png')
    plt.savefig(tier_bar_path, transparent=True, bbox_inches='tight', dpi=300)
    plt.close()

    # 3. Matched vs Missing (Gap)
    labels = tiers[::-1]
    matched_counts = [
        len(bd.get('nice_to_have', {}).get('matched', [])),
        len(bd.get('preferred', {}).get('matched', [])),
        len(bd.get('required', {}).get('matched', []))
    ]
    missing_counts = [
        len(bd.get('nice_to_have', {}).get('missing', [])),
        len(bd.get('preferred', {}).get('missing', [])),
        len(bd.get('required', {}).get('missing', []))
    ]
    
    x = np.arange(len(labels))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.barh(x - width/2, matched_counts, width, label='Matched', color=COLORS['success'])
    ax.barh(x + width/2, missing_counts, width, label='Missing', color=COLORS['danger'])

    ax.set_yticks(x)
    ax.set_yticklabels(labels)
    ax.legend(loc='upper right', frameon=False)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.title('Skill Gap Analysis', color=COLORS['dark_gray'], pad=10)
    
    matched_missing_path = os.path.join(tmp_dir, 'matched_missing.png')
    plt.savefig(matched_missing_path, transparent=True, bbox_inches='tight', dpi=300)
    plt.close()

    # 4. Radar Chart
    categories = ['Technical', 'Tools', 'Soft Skills', 'Domain', 'Leadership']
    cat_scores = []
    
    # Simple heuristic to distribute skills into radar categories for visualization
    # In a real app, the LLM could categorize them, or we use a mapping.
    # Here we'll just mock some scores based on total skills found to have a visual.
    num_skills = len(data['candidate'].get('skills_found', []))
    match_pct = overall_score / 100.0
    
    # Mock scores for radar based on overall match
    cat_scores = [
        min(100, int(80 * match_pct + 10)),
        min(100, int(90 * match_pct)),
        min(100, int(70 * match_pct + 20)),
        min(100, int(85 * match_pct + 5)),
        min(100, int(60 * match_pct + 30))
    ]
    
    N = len(categories)
    angles = [n / float(N) * 2 * math.pi for n in range(N)]
    angles += angles[:1]
    
    fig, ax = plt.subplots(figsize=(5, 5), subplot_kw={'projection': 'polar'})
    
    values = cat_scores + cat_scores[:1]
    
    ax.plot(angles, values, color=COLORS['accent'], linewidth=2, linestyle='solid')
    ax.fill(angles, values, color=COLORS['accent'], alpha=0.25)
    
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, color=COLORS['dark_gray'], size=10)
    ax.set_yticks([20, 40, 60, 80, 100])
    ax.set_yticklabels(["20", "40", "60", "80", "100"], color=COLORS['mid_gray'], size=8)
    ax.set_ylim(0, 100)
    
    radar_path = os.path.join(tmp_dir, 'radar.png')
    plt.savefig(radar_path, transparent=True, bbox_inches='tight', dpi=300)
    plt.close()

    return {
        'donut': donut_path,
        'tier_bar': tier_bar_path,
        'matched_missing': matched_missing_path,
        'radar': radar_path
    }


def sanitize_text(text: str) -> str:
    """Remove/replace characters that Helvetica (latin-1) cannot render."""
    replacements = {
        '\u2014': '-',  '\u2013': '-',
        '\u2018': "'", '\u2019': "'",
        '\u201c': '"', '\u201d': '"',
        '\u2022': '*', '\u2026': '...',
        '\u2192': '->', '\u2190': '<-',
    }
    result = []
    for ch in text:
        ch = replacements.get(ch, ch)
        try:
            ch.encode('latin-1')
            result.append(ch)
        except UnicodeEncodeError:
            result.append('')
    return ''.join(result)


def clean_markdown_text(text: str) -> str:
    """Strip common Markdown syntax for plain text rendering."""
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'`([^`]*)`', r'\1', text)
    text = text.replace('`', '')
    return text.strip()


def parse_roadmap_markdown(roadmap_text: str) -> list:
    """Parse Markdown roadmap into structured sections."""
    sections = []
    current_section = None
    current_subsection = None

    for raw_line in roadmap_text.split('\n'):
        stripped = raw_line.strip()
        if not stripped:
            continue

        if stripped.startswith('### '):
            if current_subsection and current_section:
                current_section['subsections'].append(current_subsection)
                current_subsection = None
            if current_section:
                sections.append(current_section)
            current_section = {'title': clean_markdown_text(stripped[4:]), 'items': [], 'subsections': []}

        elif stripped.startswith('#### '):
            if current_subsection and current_section:
                current_section['subsections'].append(current_subsection)
            current_subsection = {'title': clean_markdown_text(stripped[5:]), 'items': []}

        elif stripped.startswith('- ') or stripped.startswith('* '):
            content = clean_markdown_text(stripped[2:])
            if current_subsection:
                current_subsection['items'].append(content)
            elif current_section:
                current_section['items'].append(content)

        else:
            content = clean_markdown_text(stripped)
            if content:
                if current_subsection:
                    current_subsection['items'].append(content)
                elif current_section:
                    current_section['items'].append(content)

    if current_subsection and current_section:
        current_section['subsections'].append(current_subsection)
    if current_section:
        sections.append(current_section)

    return sections


class CareerReportPDF(FPDF):
    def __init__(self, candidate_name='', target_role=''):
        super().__init__('P', 'mm', 'A4')
        self.candidate_name = candidate_name
        self.target_role = target_role
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font('Helvetica', 'B', 8)
        r, g, b = hex_to_rgb(COLORS['mid_gray'])
        self.set_text_color(r, g, b)
        self.cell(0, 8, sanitize_text(f'Career Analysis Report - {self.candidate_name}'),
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        r, g, b = hex_to_rgb(COLORS['accent'])
        self.set_draw_color(r, g, b)
        self.set_line_width(0.5)
        self.line(10, 13, 200, 13)
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        r, g, b = hex_to_rgb(COLORS['mid_gray'])
        self.set_text_color(r, g, b)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', align='C')

    def section_title(self, title: str):
        self.set_font('Helvetica', 'B', 16)
        r, g, b = hex_to_rgb(COLORS['primary'])
        self.set_text_color(r, g, b)
        self.cell(0, 12, sanitize_text(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        r, g, b = hex_to_rgb(COLORS['accent'])
        self.set_draw_color(r, g, b)
        self.set_line_width(0.8)
        self.line(self.l_margin, self.get_y(), 100, self.get_y())
        self.ln(6)

    def sub_title(self, title: str):
        self.set_font('Helvetica', 'B', 13)
        r, g, b = hex_to_rgb(COLORS['dark_gray'])
        self.set_text_color(r, g, b)
        self.cell(0, 10, sanitize_text(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)

    def body_text(self, text: str, bold: bool = False):
        self.set_font('Helvetica', 'B' if bold else '', 10)
        r, g, b = hex_to_rgb(COLORS['dark_gray'])
        self.set_text_color(r, g, b)
        self.multi_cell(0, 6, sanitize_text(text))
        self.ln(2)

    def info_row(self, label: str, value: str):
        self.set_font('Helvetica', 'B', 10)
        r, g, b = hex_to_rgb(COLORS['primary'])
        self.set_text_color(r, g, b)
        self.cell(50, 7, sanitize_text(label), new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_font('Helvetica', '', 10)
        r, g, b = hex_to_rgb(COLORS['dark_gray'])
        self.set_text_color(r, g, b)
        self.cell(0, 7, sanitize_text(value), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def skill_badge(self, skill: str, is_matched: bool = True):
        color = COLORS['success'] if is_matched else COLORS['danger']
        icon = '[+]' if is_matched else '[-]'
        self.set_font('Helvetica', '', 9)
        r, g, b = hex_to_rgb(color)
        self.set_text_color(r, g, b)
        self.cell(0, 5, sanitize_text(f'  {icon}  {skill.title()}'),
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def roadmap_item(self, text: str):
        self.set_font('Helvetica', '', 10)
        r, g, b = hex_to_rgb(COLORS['dark_gray'])
        self.set_text_color(r, g, b)
        self.set_x(self.l_margin + 6)
        self.multi_cell(0, 5, sanitize_text('* ' + text))
        self.ln(1)


def build_and_save_pdf(data: dict, output_path: str = 'career_analysis_report.pdf'):
    """
    Generate charts, build the PDF report using CareerReportPDF,
    and save it to output_path.
    """
    tmp_dir = 'tmp_charts'
    chart_paths = generate_charts(data, tmp_dir)

    pdf = CareerReportPDF(
        candidate_name=data.get('candidate', {}).get('name', 'Candidate'),
        target_role=data.get('target_role', {}).get('title', 'Role')
    )
    pdf.alias_nb_pages()

    # PAGE 1: Cover
    pdf.add_page()
    pdf.ln(20)
    pdf.set_font('Helvetica', 'B', 28)
    r, g, b = hex_to_rgb(COLORS['primary'])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 15, 'Career Analysis Report', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font('Helvetica', '', 12)
    r, g, b = hex_to_rgb(COLORS['mid_gray'])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 8, 'AI-Powered Skills Gap Analysis & Learning Roadmap',
             align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(5)
    r, g, b = hex_to_rgb(COLORS['accent'])
    pdf.set_draw_color(r, g, b)
    pdf.set_line_width(1)
    pdf.line(60, pdf.get_y(), 150, pdf.get_y())
    pdf.ln(12)

    pdf.set_font('Helvetica', 'B', 13)
    r, g, b = hex_to_rgb(COLORS['dark_gray'])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 8, 'Candidate Profile', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    pdf.info_row('Name:', data.get('candidate', {}).get('name', 'N/A'))
    pdf.info_row('Current Title:', data.get('candidate', {}).get('title', 'N/A'))
    pdf.info_row('Total Skills:', str(len(data.get('candidate', {}).get('skills_found', []))))
    pdf.ln(4)
    pdf.set_font('Helvetica', 'B', 13)
    r, g, b = hex_to_rgb(COLORS['dark_gray'])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 8, 'Target Role', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    pdf.info_row('Position:', data.get('target_role', {}).get('title', 'N/A'))
    pdf.info_row('Company:', data.get('target_role', {}).get('company', 'N/A'))
    pdf.ln(8)

    if os.path.exists(chart_paths['donut']):
        img_w = 65
        pdf.image(chart_paths['donut'], x=(210 - img_w) / 2, y=pdf.get_y(), w=img_w)
        pdf.ln(70)

    pdf.set_font('Helvetica', 'I', 9)
    r, g, b = hex_to_rgb(COLORS['mid_gray'])
    pdf.set_text_color(r, g, b)
    pdf.cell(0, 8, f"Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')}",
             align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # PAGE 2: Skills Breakdown
    pdf.add_page()
    pdf.section_title('Skills Match Breakdown')
    overall = data.get('match_score', {}).get('overall', 0)
    bd_pdf = data.get('match_score', {}).get('breakdown', {})
    pdf.body_text(f'Overall match score: {overall}%. Below is the detailed breakdown by skill tier.')

    if os.path.exists(chart_paths['tier_bar']):
        pdf.image(chart_paths['tier_bar'], x=15, w=180)
        pdf.ln(5)
    if os.path.exists(chart_paths['matched_missing']):
        pdf.image(chart_paths['matched_missing'], x=25, w=155)
        pdf.ln(5)

    pdf.sub_title('[+] Matched Skills')
    for tier in ['required', 'preferred', 'nice_to_have']:
        if tier in bd_pdf and bd_pdf[tier].get('matched'):
            label = tier.replace('_', ' ').title()
            pdf.set_font('Helvetica', 'B', 10)
            r, g, b = hex_to_rgb(COLORS['primary'])
            pdf.set_text_color(r, g, b)
            pdf.cell(0, 6, sanitize_text(f'  {label}:'), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            for skill in bd_pdf[tier]['matched']:
                pdf.skill_badge(skill, is_matched=True)
            pdf.ln(2)

    pdf.sub_title('[-] Missing Skills (Gap)')
    for tier in ['required', 'preferred', 'nice_to_have']:
        if tier in bd_pdf and bd_pdf[tier].get('missing'):
            label = tier.replace('_', ' ').title()
            pdf.set_font('Helvetica', 'B', 10)
            r, g, b = hex_to_rgb(COLORS['primary'])
            pdf.set_text_color(r, g, b)
            pdf.cell(0, 6, sanitize_text(f'  {label}:'), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            for skill in bd_pdf[tier]['missing']:
                pdf.skill_badge(skill, is_matched=False)
            pdf.ln(2)

    # PAGE 3: Skills Radar + Inventory
    pdf.add_page()
    pdf.section_title('Candidate Skills Overview')
    skills_all = data.get('candidate', {}).get('skills_found', [])
    pdf.body_text(f"{data.get('candidate', {}).get('name', 'Candidate')} has {len(skills_all)} identified skills "
                  'across technical, tools, and soft skills categories.')

    if os.path.exists(chart_paths['radar']):
        img_w = 140
        pdf.image(chart_paths['radar'], x=(210 - img_w) / 2, w=img_w)
        pdf.ln(5)

    pdf.sub_title('Complete Skills Inventory')
    sorted_skills = sorted(skills_all)
    col_width = 60
    x_start = pdf.l_margin
    pdf.set_font('Helvetica', '', 9)
    r, g, b = hex_to_rgb(COLORS['dark_gray'])
    pdf.set_text_color(r, g, b)
    for i, skill in enumerate(sorted_skills):
        col = i % 3
        if col == 0 and i > 0:
            pdf.ln(5)
        pdf.set_x(x_start + col * col_width)
        pdf.cell(col_width, 5, f'  * {skill.title()}', new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.ln(10)

    # PAGE 4+: Learning Roadmap
    pdf.add_page()
    pdf.section_title('30-Day Learning Roadmap')
    roadmap_text = data.get('roadmap_markdown', '')

    if roadmap_text:
        sections = parse_roadmap_markdown(roadmap_text)
        for section in sections:
            if pdf.get_y() > 240:
                pdf.add_page()
            pdf.sub_title(section['title'])
            for item in section['items']:
                pdf.roadmap_item(item)
            for subsection in section.get('subsections', []):
                if pdf.get_y() > 250:
                    pdf.add_page()
                pdf.set_font('Helvetica', 'B', 11)
                r, g, b = hex_to_rgb(COLORS['accent'])
                pdf.set_text_color(r, g, b)
                pdf.cell(0, 8, sanitize_text(f"  {subsection['title']}"),
                         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                for item in subsection['items']:
                    pdf.roadmap_item(item)
            pdf.ln(4)
    else:
        pdf.body_text('No roadmap data available.')

    # PAGE 5: Scout Roles
    scout_text = data.get('scout_results')
    if scout_text and isinstance(scout_text, str):
        pdf.add_page()
        pdf.section_title('Job Opportunities Discovered')
        pdf.body_text('The following real-time roles were found via the Scout Agent:')
        pdf.ln(5)
        
        pdf.set_font('Helvetica', '', 10)
        r, g, b = hex_to_rgb(COLORS['dark_gray'])
        pdf.set_text_color(r, g, b)
        
        try:
            import markdown
            # Make sure special characters don't break fpdf parsing if any edge-cases arise
            safe_text = sanitize_text(scout_text)
            html_table = markdown.markdown(safe_text, extensions=['tables'])
            
            # Add table CSS for fpdf2 to read
            styled_html = f"""
            <font color="{COLORS['dark_gray']}">
            {html_table}
            </font>
            """
            pdf.write_html(styled_html)
        except Exception as e:
            # Fallback for manual line printing if formatting fails
            print(f"Failed to render HTML table in PDF: {e}")
            for raw_line in scout_text.split('\n'):
                stripped = raw_line.strip()
                if not stripped:
                    continue
                if stripped.startswith('|') and '---' in stripped:
                    continue # skip markdown table separators
                
                pdf.multi_cell(0, 5, sanitize_text(clean_markdown_text(stripped)))
                pdf.ln(1)

    # Save
    pdf.output(output_path)
    
    # Cleanup tmp charts
    shutil.rmtree(tmp_dir, ignore_errors=True)
    
    return output_path
