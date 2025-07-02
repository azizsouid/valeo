# Initialize
from app import create_app, db
from app.models import Material
app = create_app()
app.app_context().push()

# Set standard pressures
materials = [
    {"name": "Polycarbonate (PC)", "pressure": 500},  # 500 bar
    {"name": "ABS", "pressure": 300},                # 300 bar
    {"name": "Nylon", "pressure": 400},
    {"name": "PP", "pressure": 350}
]

# Add/update materials
for mat in materials:
    existing = Material.query.filter_by(name=mat["name"]).first()
    if existing:
        existing.pressure = mat["pressure"]
    else:
        db.session.add(Material(**mat))
db.session.commit()

# Verify
print(Material.query.all())