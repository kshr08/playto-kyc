from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """
    Returns all errors in the shape:
    {
        "error": true,
        "message": "Human-readable summary",
        "detail": <original DRF detail or field errors>
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        data = response.data

        # DRF field validation errors are dicts
        if isinstance(data, dict):
            if 'detail' in data and len(data) == 1:
                message = str(data['detail'])
            elif 'non_field_errors' in data:
                message = '; '.join(str(e) for e in data['non_field_errors'])
            else:
                # Field errors
                parts = []
                for field, errors in data.items():
                    if isinstance(errors, list):
                        parts.append(f"{field}: {'; '.join(str(e) for e in errors)}")
                    else:
                        parts.append(f"{field}: {errors}")
                message = ' | '.join(parts)
        elif isinstance(data, list):
            message = '; '.join(str(e) for e in data)
        else:
            message = str(data)

        response.data = {
            'error': True,
            'message': message,
            'detail': data,
        }

    return response
