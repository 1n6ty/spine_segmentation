from pydantic import BaseModel, model_validator
from typing import Optional, Literal

class Login_POST_schema(BaseModel):
    
    username: Optional[str] = None
    password: Optional[str] = None

    remember_me: Literal["true", 'false'] = "false"

    @model_validator(mode="after")
    def val(self):
        if bool(self.username) ^ bool(self.password):
            raise ValueError("Both 'username' and 'password' should be provided, or none.")
        return self